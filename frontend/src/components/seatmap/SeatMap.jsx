// src/components/seatmap/SeatMap.jsx
import React, { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { fetchAdminSeatmap, saveDraftSeatmap, publishSeatmap } from "../../utils/seatMapPersistence.js";
import { cleanupReservationsForDeletedTable, cleanupReservationsForDeletedSeat, cleanupReservationsForDeletedStandaloneSeat } from "../../utils/reservationCleanup.js";
import { authAPI } from "../../services/authAPI.js";
import { getScopedOutletGroups } from "../../constants/outletCatalog.js";
import { useAdminTheme, C as adminC, F as adminF } from "../../context/AdminThemeContext.jsx";
import {
  Undo2, Redo2, Lock, Unlock, Copy, Plus, Trash2, Grid, RotateCw, ZoomIn, ZoomOut, Check, Square, Circle,
  Download, Upload, RotateCcw, Eye, EyeOff, X
} from "lucide-react";


// Status Colors
export const STATUS_COLORS = {
  available: "#4A9E7E",
  unavailable: "#B85C5C",
  pending: "#C4A35A",
  reserved: "#B85C5C",
  rejected: "#4A9E7E",
};
export const STATUS_LABELS = {
  available: "AVAILABLE",
  unavailable: "UNAVAILABLE",
  pending: "PENDING",
  reserved: "RESERVED",
  approved: "APPROVED",
  rejected: "REJECTED",
};
const SEAT_STATUS_CYCLE = ["available", "pending", "reserved"];

const F = "'Inter', 'Helvetica Neue', Arial, sans-serif";

const hexToRgba = (hex, opacity) => {
  if (!hex) return "rgba(250, 249, 245, 1)";
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
  }
  if (hex.length !== 6) return `rgba(250, 249, 245, ${opacity / 100})`;
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity / 100})`;
};

const isDarkColor = (color) => {
  if (!color) return false;
  const c = color.toLowerCase();
  if (c.includes("gradient")) {
    return c.includes("#1e1b18") || c.includes("#0d0a09") || c.includes("dark") || c.includes("#2a251d");
  }
  if (c.startsWith("#")) {
    const hex = c.substring(1);
    let r = 255, g = 255, b = 255;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    }
    return (r * 0.299 + g * 0.587 + b * 0.114) < 128;
  }
  if (c === "black" || c === "charcoal" || c === "darkgray") return true;
  return false;
};

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
  } catch { }
}

// ─── Theme tokens ─────────────────────────────────────────────────────────────
function getClientTokens(isDark) {
  return isDark
    ? {
      gold: "#C4A35A", goldFaint: "rgba(196,163,90,0.10)", goldFaintest: "rgba(196,163,90,0.05)",
      // Canvas & Table elements remain light-styled for layout design readability
      canvasBg: "#EDEAE2", canvasBorder: "rgba(140,107,42,0.18)",
      tableBg: "#FFFFFF", tableSelected: "#FFFBF2", tableBgHov: "#FAF8F2",
      borderDefault: "rgba(255,255,255,0.08)", borderStrong: "rgba(255,255,255,0.14)",
      borderAccent: "rgba(196,163,90,0.35)",
      textPrimary: "#EDE8DF", textSecondary: "#8A8278", textTertiary: "rgba(237,232,223,0.32)",
      divider: "rgba(255,255,255,0.06)", cardShadow: "0 1px 4px rgba(0,0,0,0.30)",
      labelScreen: { bg: "#8C6B2A", color: "#FFFFFF" },
      labelOther: { color: "#7A7060", border: "rgba(0,0,0,0.10)" },
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
  get gold() { return adminC.gold; },
  get goldLight() { return adminC.goldLight; },
  get goldSoft() { return adminC.goldSoft; },
  get goldFaint() { return adminC.goldFaint; },
  get goldFaintest() { return adminC.goldFaintest; },
  get pageBg() { return adminC.pageBg; },
  get surfaceBase() { return adminC.surfaceBase; },
  get surfaceRaised() { return adminC.surfaceRaised; },
  get surfaceInput() { return adminC.surfaceInput; },
  get borderDefault() { return adminC.borderDefault; },
  get borderStrong() { return adminC.borderStrong; },
  get borderAccent() { return adminC.borderAccent; },
  get textPrimary() { return adminC.textPrimary; },
  get textSecondary() { return adminC.textSecondary; },
  get textTertiary() { return adminC.textTertiary; },
  get textOnAccent() { return adminC.textOnAccent; },
  get red() { return adminC.red; },
  get redFaint() { return adminC.redFaint; },
  get redBorder() { return adminC.redBorder; },
  get green() { return adminC.green; },
  get greenFaint() { return adminC.greenFaint; },
  get greenBorder() { return adminC.greenBorder; },
  get navBg() { return adminC.navBg; },
  get navBorder() { return adminC.navBorder; },
  get divider() { return adminC.divider; },

  // Canvas elements must stay light-themed (white/cream)
  get canvasBg() { return "#EDEAE2"; },
  get canvasBorder() { return "rgba(140,107,42,0.18)"; },
  get tableBg() { return "#FFFFFF"; },
  get tableSelected() { return "#FFFBF2"; },

  // Sidebar colors dynamic
  get sidebarBg() { return adminC.surfaceSoft; },
  get sidebarBorder() { return adminC.divider; },

  // Shadows / focus
  get inputFocus() { return adminC.inputFocusShadow || "0 0 0 3px rgba(140,107,42,0.10)"; },
  get cardShadow() { return adminC.shadowSoft || "0 1px 4px rgba(0,0,0,0.06)"; },
};

// FIX: Use let so these can be reset when a room is loaded
let _tableCounter = 1, _standaloneCounter = 1, _fixtureCounter = 1;

export function checkCollision(t1, t2) {
  const w1 = t1.width || 110;
  const h1 = t1.height || 70;
  const w2 = t2.width || 110;
  const h2 = t2.height || 70;
  return (
    t1.x < t2.x + w2 &&
    t1.x + w1 > t2.x &&
    t1.y < t2.y + h2 &&
    t1.y + h1 > t2.y
  );
}

export function getSeatsCoordinates(table) {
  const seats = table.seats || [];
  const N = seats.length;
  if (N === 0) return [];

  const shape = table.shape || "rect";
  const w = table.width || 110;
  const h = table.height || 70;

  // Retrieve physical chair footprint from style
  const chairStyleId = table.editor?.chair_style || "standard-dining";
  const chairStyle = CHAIR_STYLES.find(c => c.id === chairStyleId) || CHAIR_STYLES[0];
  const chairW = chairStyle.width || 38;
  const chairH = chairStyle.depth || 38;
  const spacingCm = table.editor?.seat_spacing_cm || 8;
  const mult = chairStyle.spacingMultiplier || 1.0;

  if (shape === "round" || shape === "oval") {
    // Circumference scaling for overlap prevention
    const chairFootprint = (chairW + spacingCm) * mult;
    const minCircumference = N * chairFootprint;
    const minRadius = minCircumference / (2 * Math.PI);

    const baseRx = w / 2;
    const baseRy = (shape === "round" ? w : h) / 2;

    const pad = Math.max(18, chairH / 2 + 4);
    const rx = Math.max(baseRx + pad, minRadius);
    const ry = Math.max(baseRy + pad, minRadius * (baseRy / baseRx || 1));

    const cx = w / 2;
    const cy = h / 2;
    return seats.map((seat, i) => {
      const angle = (i * 2 * Math.PI) / N;
      const sx = cx + rx * Math.cos(angle) - 19;
      const sy = cy + ry * Math.sin(angle) - 19;
      const rot = (angle * 180) / Math.PI - 90;
      return { seat, x: sx, y: sy, rotation: rot };
    });
  }

  let nLeft = 0, nRight = 0, nTop = 0, nBottom = 0;

  if (shape === "square" || w === h) {
    const base = Math.floor(N / 4);
    const rem = N % 4;
    nTop = base + (rem > 0 ? 1 : 0);
    nBottom = base + (rem > 1 ? 1 : 0);
    nLeft = base + (rem > 2 ? 1 : 0);
    nRight = base;
  } else {
    // Symmetrical rectangular/banquet seat distributions prioritizing long edges
    if (w >= h) {
      if (N <= 2) {
        nTop = 1;
        nBottom = N - 1;
      } else {
        const sideCapacity = Math.max(1, Math.floor(w / (chairW + spacingCm)));
        nTop = Math.min(sideCapacity, Math.ceil(N / 2));
        nBottom = Math.min(sideCapacity, N - nTop);
        const rem = N - (nTop + nBottom);
        if (rem > 0) {
          nLeft = Math.ceil(rem / 2);
          nRight = rem - nLeft;
        }
      }
    } else {
      if (N <= 2) {
        nLeft = 1;
        nRight = N - 1;
      } else {
        const sideCapacity = Math.max(1, Math.floor(h / (chairW + spacingCm)));
        nLeft = Math.min(sideCapacity, Math.ceil(N / 2));
        nRight = Math.min(sideCapacity, N - nLeft);
        const rem = N - (nLeft + nRight);
        if (rem > 0) {
          nTop = Math.ceil(rem / 2);
          nBottom = rem - nTop;
        }
      }
    }
  }

  const coordinates = [];
  let seatIdx = 0;

  const addSideSeats = (count, side) => {
    if (count <= 0) return;
    const length = (side === "top" || side === "bottom") ? w : h;
    const chairSpacing = (chairW + spacingCm) * mult;
    const totalSpan = (count - 1) * chairSpacing;
    const startPos = (length - totalSpan) / 2;

    for (let i = 0; i < count; i++) {
      if (seatIdx >= N) break;
      const seat = seats[seatIdx++];
      let sx, sy, rot;

      const pos = count === 1
        ? length / 2
        : startPos + i * chairSpacing;

      const chairDist = Math.max(22, chairH / 2 + 4);

      if (side === "top") {
        sx = pos - 19;
        sy = -chairDist - 19;
        rot = 180;
      } else if (side === "bottom") {
        sx = pos - 19;
        sy = h + chairDist - 19;
        rot = 0;
      } else if (side === "left") {
        sx = -chairDist - 19;
        sy = pos - 19;
        rot = 90;
      } else if (side === "right") {
        sx = w + chairDist - 19;
        sy = pos - 19;
        rot = 270;
      }
      coordinates.push({ seat, x: sx, y: sy, rotation: rot });
    }
  };

  addSideSeats(nTop, "top");
  addSideSeats(nBottom, "bottom");
  addSideSeats(nLeft, "left");
  addSideSeats(nRight, "right");

  while (seatIdx < N) {
    const seat = seats[seatIdx];
    coordinates.push({ seat, x: w / 2 - 19, y: h + 18 - 19, rotation: 0 });
    seatIdx++;
  }

  return coordinates;
}

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

const DEFAULT_LABELS = [];

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

// ─── FIX: Canonical wing resolver — single source of truth ───────────────────
function getActualWingForRoom(room, venueStructure) {
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

  let structure = venueStructure;
  if (!structure) {
    try {
      const raw = localStorage.getItem("bellevue_venue_structure");
      if (raw) {
        structure = JSON.parse(raw);
      }
    } catch { }
  }
  if (structure && Array.isArray(structure)) {
    for (const wing of structure) {
      if (wing.rooms?.includes(room) || wing.rooms?.includes(canonicalRoom)) return wing.label;
    }
  }
  return "Main Wing";
}

// ─── FIX: layoutKey always derived from room name, never from caller's wing ──
function layoutKey(wing, room) {
  const actualWing = getActualWingForRoom(room);
  return `seatmap_layout:${actualWing}:${room}`;
}

function resetLayoutAvailability(data = {}) {
  const resetSeat = (seat) => ({
    ...seat,
    status: String(seat?.status || "").toLowerCase() === "maintenance" ? "maintenance" : "available",
  });

  return {
    ...data,
    tables: (data.tables || []).map((table) => ({
      ...table,
      seats: (table.seats || []).map(resetSeat),
    })),
    standaloneSeats: (data.standaloneSeats || []).map(resetSeat),
  };
}

function withSeatmapSaveMetadata(wing, room, data) {
  const layoutData = resetLayoutAvailability(data);
  return {
    ...layoutData,
    v: 2,
    seatmap_saved_at: new Date().toISOString(),
    seatmap_scope: {
      wing: getActualWingForRoom(room),
      room,
    },
  };
}

// Removed old localStorage-based saveLayout and loadLayout

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
  const renderedW = Math.round(virtualW * scale);
  return (
    <div ref={sizerRef} style={{ width: "100%", height: "100%", position: "relative", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <div style={{ width: renderedW, height: renderedH, position: "relative", overflow: "hidden", flexShrink: 0 }}>
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

function DraggableLabel({ item, onDragStart, isDragging, T }) {
  const [hov, setHov] = useState(false);
  const isScreen = item.type === "screen";
  const tokens = T || {
    gold: C.gold, borderDefault: C.borderDefault, borderAccent: C.borderAccent,
    textSecondary: C.textSecondary,
    labelScreen: { bg: C.gold, color: "#fff" },
    labelOther: { color: C.textSecondary, border: C.borderDefault }
  };
  return (
    <div
      title={`Drag ${item.label}`}
      style={{
        position: "absolute", left: (item.x || 0), top: (item.y || 0),
        background: isScreen ? tokens.labelScreen.bg : "transparent",
        color: isScreen ? tokens.labelScreen.color : tokens.labelOther.color,
        border: isScreen ? "none" : `1px solid ${hov || isDragging ? tokens.borderAccent : tokens.labelOther.border}`,
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
        {[0, 1, 2].map(i => (
          <span key={i} style={{ display: "flex", gap: 3 }}>
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: isScreen ? "#fff" : tokens.gold, display: "block", flexShrink: 0, opacity: 1 }} />
            <span style={{ width: 4, height: 4, borderRadius: "50%", background: isScreen ? "#fff" : tokens.gold, display: "block", flexShrink: 0, opacity: 1 }} />
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
  const color = STATUS_COLORS[seat.status] || STATUS_COLORS.available;

  const rotation = seat.editor?.rotation || 0;
  const chairStyle = seat.editor?.chair_style || "standard-standalone";
  const width = seat.editor?.width || 38;
  const height = seat.editor?.height || 38;
  const isReservable = seat.editor?.reservable !== false;

  const tokens = T || { gold: C.gold, cardShadow: C.cardShadow };

  // Calculate distinct colors based on status/reservability
  const baseColor = isReservable ? color : "#8A8278"; // neutral grey if non-reservable

  return (
    <div
      style={{
        position: "absolute",
        left: seat.x || 0,
        top: seat.y || 0,
        width: width,
        height: height,
        zIndex: isSelected ? 15 : 6,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "center center",
      }}
      onMouseEnter={() => !blocked && setHov(true)}
      onMouseLeave={() => setHov(false)}
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
      title={blocked ? "Unavailable for selected schedule" : `${seat.label || seat.id}`}
    >
      <div style={{
        width: "100%",
        height: "100%",
        borderRadius: chairStyle === "sofa-seat" || chairStyle === "bench-seat" ? "6px" : "50%",
        background: (isSelected || isMultiSelected) ? "transparent" : baseColor,
        border: (isSelected || isMultiSelected) ? `2.5px solid ${tokens.gold}` : `1.5px solid rgba(0,0,0,0.08)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: editMode ? (isDragging ? "grabbing" : "grab") : blocked ? "not-allowed" : "pointer",
        boxShadow: (isSelected || isMultiSelected) ? `0 0 0 3px ${tokens.gold}28` : hov ? "0 2px 8px rgba(0,0,0,0.18)" : tokens.cardShadow,
        transform: (isSelected || isMultiSelected) ? "scale(1.12)" : hov ? "scale(1.06)" : "scale(1)",
        opacity: blocked ? 0.48 : 1,
        userSelect: "none",
        transition: "all 0.15s ease",
        position: "relative",
      }}>
        {/* Render a custom vector outline depending on style */}
        <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
          {/* VIP Chair Gold ring */}
          {chairStyle === "vip-chair" && (
            <circle cx="50%" cy="50%" r={width / 2 - 4} fill="none" stroke={tokens.gold} strokeWidth={1.5} opacity={0.6} />
          )}
          {/* Backrest overlay for standard/premium chairs */}
          {["standard-standalone", "premium-standalone", "arm-chair", "vip-chair"].includes(chairStyle) && (
            <path d={`M ${width * 0.15},${height * 0.15} Q ${width * 0.5},${-height * 0.05} ${width * 0.85},${height * 0.15}`} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeLinecap="round" />
          )}
          {/* Armrests */}
          {["premium-standalone", "arm-chair", "vip-chair", "lounge-chair"].includes(chairStyle) && (
            <>
              <line x1={width * 0.08} y1={height * 0.2} x2={width * 0.08} y2={height * 0.7} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeLinecap="round" />
              <line x1={width * 0.92} y1={height * 0.2} x2={width * 0.92} y2={height * 0.7} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeLinecap="round" />
            </>
          )}
          {/* Bar stool circle seat cushion ring */}
          {chairStyle === "bar-stool" && (
            <circle cx="50%" cy="50%" r={width / 2 - 5} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
          )}
          {/* Sofa details */}
          {chairStyle === "sofa-seat" && (
            <>
              {/* Sofa back cushion */}
              <rect x={width * 0.1} y={height * 0.1} width={width * 0.8} height={height * 0.2} rx={2} fill="rgba(255,255,255,0.2)" />
              {/* Sofa arms */}
              <rect x={width * 0.05} y={height * 0.25} width={width * 0.12} height={height * 0.65} rx={1} fill="rgba(255,255,255,0.15)" />
              <rect x={width * 0.83} y={height * 0.25} width={width * 0.12} height={height * 0.65} rx={1} fill="rgba(255,255,255,0.15)" />
            </>
          )}
          {/* Bench seat details */}
          {chairStyle === "bench-seat" && (
            <>
              <rect x={width * 0.05} y={height * 0.1} width={width * 0.9} height={height * 0.2} rx={1} fill="rgba(255,255,255,0.2)" />
              <line x1={width * 0.5} y1={height * 0.3} x2={width * 0.5} y2={height * 0.9} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
            </>
          )}
        </svg>

        <span style={{
          color: (isSelected || isMultiSelected) ? tokens.gold : "#fff",
          fontSize: width > 45 ? 11 : 9,
          fontWeight: 800,
          fontFamily: F,
          lineHeight: 1,
          pointerEvents: "none",
          zIndex: 1,
          marginTop: ["sofa-seat", "bench-seat"].includes(chairStyle) ? 6 : 0
        }}>
          {seat.num}
        </span>

        {(isSelected || isMultiSelected) && (
          <div style={{
            position: "absolute",
            top: "-4px",
            right: "-4px",
            width: "12px",
            height: "12px",
            borderRadius: "50%",
            background: tokens.gold,
            border: "2px solid #fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "8px",
            fontWeight: "bold",
            color: "#fff",
            zIndex: 20
          }}>✓</div>
        )}
      </div>
    </div>
  );
}

function SeatNode({ seat, isSelected, editMode, isDragging, onSeatClick, onSeatDragStart, T, rotation = 0, isBench = false, chairStyle = "standard-dining", tableRotation = 0 }) {
  const [hov, setHov] = useState(false);
  const blocked = !editMode && seat.status !== "available";
  const color = STATUS_COLORS[seat.status] || STATUS_COLORS.available;

  const sizeMap = {
    "standard-dining": 38,
    "premium-dining": 42,
    "high-chair": 34,
    "bar-stool": 34,
    "arm-chair": 42,
    "banquet-chair": 38,
    "sofa-chair": 46,
    "bench-seat": 46,
    "lounge-chair": 42,
    "vip-chair": 42,
    "child-chair": 32,
  };
  const SIZE = sizeMap[chairStyle] || 38;
  const tokens = T || { gold: C.gold, cardShadow: C.cardShadow };

  const isBenchStyle = chairStyle === "bench-seat" || chairStyle === "sofa-chair";
  const seatColor = isSelected ? "transparent" : color;
  const totalRot = (tableRotation || 0) + (rotation || 0);

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
        position: "absolute",
        left: 19 - SIZE / 2,
        top: 19 - SIZE / 2,
        width: SIZE,
        height: SIZE,
        borderRadius: isBenchStyle ? "6px" : "50%",
        background: isBench
          ? (isSelected ? "rgba(196,163,90,0.30)" : "rgba(255,255,255,0.75)")
          : seatColor,
        border: isSelected ? `2px solid ${tokens.gold}` : isBench ? `1.5px solid ${tokens.gold}50` : `1.5px solid rgba(0,0,0,0.08)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: editMode ? "grab" : blocked ? "not-allowed" : "pointer",
        boxShadow: isSelected ? `0 0 0 3px ${tokens.gold}28` : hov ? "0 2px 8px rgba(0,0,0,0.18)" : tokens.cardShadow,
        transform: `scale(${isSelected ? 1.12 : hov ? 1.06 : 1}) rotate(${rotation}deg)`,
        opacity: blocked ? 0.48 : 1,
        flexShrink: 0,
        userSelect: "none",
        transition: "all 0.15s ease",
      }}
    >
      {/* SVG chair details */}
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", overflow: "visible" }}>
        {/* VIP Chair Gold ring */}
        {chairStyle === "vip-chair" && (
          <circle cx="50%" cy="50%" r={SIZE / 2 - 4} fill="none" stroke={tokens.gold} strokeWidth={1.5} opacity={0.6} />
        )}
        {/* Backrest overlay */}
        {["standard-dining", "premium-dining", "arm-chair", "vip-chair", "banquet-chair", "child-chair", "lounge-chair"].includes(chairStyle) && (
          <path d={`M ${SIZE * 0.15},${SIZE * 0.15} Q ${SIZE * 0.5},${-SIZE * 0.05} ${SIZE * 0.85},${SIZE * 0.15}`} fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2} strokeLinecap="round" />
        )}
        {/* Armrests */}
        {["premium-dining", "arm-chair", "vip-chair", "lounge-chair"].includes(chairStyle) && (
          <>
            <line x1={SIZE * 0.08} y1={SIZE * 0.2} x2={SIZE * 0.08} y2={SIZE * 0.7} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeLinecap="round" />
            <line x1={SIZE * 0.92} y1={SIZE * 0.2} x2={SIZE * 0.92} y2={SIZE * 0.7} stroke="rgba(255,255,255,0.3)" strokeWidth={1.5} strokeLinecap="round" />
          </>
        )}
        {/* Bar stool seat ring */}
        {chairStyle === "bar-stool" && (
          <circle cx="50%" cy="50%" r={SIZE / 2 - 5} fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth={1.5} />
        )}
        {/* Sofa details */}
        {chairStyle === "sofa-chair" && (
          <>
            <rect x={SIZE * 0.1} y={SIZE * 0.1} width={SIZE * 0.8} height={SIZE * 0.2} rx={2} fill="rgba(255,255,255,0.2)" />
            <rect x={SIZE * 0.05} y={SIZE * 0.25} width={SIZE * 0.12} height={SIZE * 0.65} rx={1} fill="rgba(255,255,255,0.15)" />
            <rect x={SIZE * 0.83} y={SIZE * 0.25} width={SIZE * 0.12} height={SIZE * 0.65} rx={1} fill="rgba(255,255,255,0.15)" />
          </>
        )}
        {/* Bench seat details */}
        {chairStyle === "bench-seat" && (
          <>
            <rect x={SIZE * 0.05} y={SIZE * 0.1} width={SIZE * 0.9} height={SIZE * 0.2} rx={1} fill="rgba(255,255,255,0.2)" />
            <line x1={SIZE * 0.5} y1={SIZE * 0.3} x2={SIZE * 0.5} y2={SIZE * 0.9} stroke="rgba(255,255,255,0.15)" strokeWidth={1.5} />
          </>
        )}
      </svg>

      <span style={{
        color: (isSelected || isBench) ? tokens.gold : "#fff",
        fontSize: SIZE > 40 ? 11 : 9,
        fontWeight: 800,
        fontFamily: F,
        lineHeight: 1,
        pointerEvents: "none",
        zIndex: 1,
        transform: `rotate(${-totalRot}deg)`,
        transformOrigin: "center center",
        display: "inline-block",
        marginTop: ["sofa-chair", "bench-seat"].includes(chairStyle) ? 4 : 0
      }}>
        {seat.num}
      </span>
    </div>
  );
}

function TableNode({ table, editMode, isTableSelected, selectedSeatId, onSelectTable, onDragStart, onResizeStart, onSeatClick, onLabelEdit, isDragging, onSeatMove, T, wing, room, mode, isColliding }) {
  const [hov, setHov] = useState(false);
  const [editingLabel, setEditingLabel] = useState(false);
  const [labelVal, setLabelVal] = useState(table.label || table.id);
  const tableBodyRef = useRef(null);
  const tokens = T || {
    gold: C.gold, cardShadow: C.cardShadow, tableBg: C.tableBg, tableSelected: C.tableSelected,
    borderDefault: C.borderDefault, borderAccent: C.borderAccent,
    textPrimary: C.textPrimary, textTertiary: C.textTertiary, divider: C.divider,
  };

  const seats = table.seats || [];
  const totalSeats = seats.length;
  const unavailableSeats = seats.filter(s => s.status === "unavailable" || s.status === "reserved").length;
  const pendingSeats = seats.filter(s => s.status === "pending").length;
  const availableSeats = seats.filter(s => s.status === "available").length;

  let tableStatus = "available";
  if (totalSeats > 0) {
    if (unavailableSeats === totalSeats) {
      tableStatus = "unavailable";
    } else if (pendingSeats === totalSeats) {
      tableStatus = "pending";
    } else if (unavailableSeats + pendingSeats === totalSeats) {
      tableStatus = unavailableSeats > 0 ? "unavailable" : "pending";
    } else if (unavailableSeats > 0 || pendingSeats > 0) {
      tableStatus = "partial";
    }
  }

  const isTableBlockedForSelection = !editMode && (
    (mode === "whole" && (table.seats || []).some(seat => seat.status !== "available")) ||
    (mode === "individual" && (table.seats || []).every(seat => seat.status !== "available"))
  );

  useEffect(() => setLabelVal(table.label || table.id), [table.label, table.id]);

  const tableW = Math.max(table.width || 110, 80);
  const tableH = Math.max(table.height || 70, 50);
  const rotation = table.editor?.rotation || 0;
  const isLocked = table.editor?.locked || false;

  const seatCoordinates = getSeatsCoordinates(table);

  // Bench seating calculations
  const isBench = table.editor?.chair_style === "bench-seat";
  const hasTopBench = isBench && seatCoordinates.some(c => c.rotation === 180);
  const hasBottomBench = isBench && seatCoordinates.some(c => c.rotation === 0);
  const hasLeftBench = isBench && seatCoordinates.some(c => c.rotation === 90);
  const hasRightBench = isBench && seatCoordinates.some(c => c.rotation === 270);

  return (
    <div
      style={{
        position: "absolute",
        left: (table.x || 0),
        top: (table.y || 0),
        width: tableW,
        height: tableH,
        overflow: "visible",
        zIndex: isTableSelected ? 10 : 4,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "center center",
        transition: isDragging ? "none" : "transform 0.15s ease",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={e => e.stopPropagation()}
    >
      {/* Bench seat background segments */}
      {hasTopBench && (
        <div style={{
          position: "absolute", left: 2, width: tableW - 4, top: -41, height: 18,
          background: "#E8E4D9", border: `1.5px solid ${tokens.gold}60`, borderRadius: 4, zIndex: 1, pointerEvents: "none"
        }} />
      )}
      {hasBottomBench && (
        <div style={{
          position: "absolute", left: 2, width: tableW - 4, bottom: -41, height: 18,
          background: "#E8E4D9", border: `1.5px solid ${tokens.gold}60`, borderRadius: 4, zIndex: 1, pointerEvents: "none"
        }} />
      )}
      {hasLeftBench && (
        <div style={{
          position: "absolute", top: 2, height: tableH - 4, left: -41, width: 18,
          background: "#E8E4D9", border: `1.5px solid ${tokens.gold}60`, borderRadius: 4, zIndex: 1, pointerEvents: "none"
        }} />
      )}
      {hasRightBench && (
        <div style={{
          position: "absolute", top: 2, height: tableH - 4, right: -41, width: 18,
          background: "#E8E4D9", border: `1.5px solid ${tokens.gold}60`, borderRadius: 4, zIndex: 1, pointerEvents: "none"
        }} />
      )}

      {/* Absolute Seats */}
      {seatCoordinates.map(({ seat, x, y, rotation: seatRot }) => (
        <div key={seat.id || seat.num} style={{ position: "absolute", left: x, top: y, width: 38, height: 38, zIndex: 3 }}>
          <SeatNode
            seat={seat}
            isSelected={seat.id === selectedSeatId}
            editMode={editMode}
            onSeatClick={s => onSeatClick(s, table.id)}
            T={tokens}
            rotation={seatRot}
            isBench={isBench}
            chairStyle={table.editor?.chair_style || "standard-dining"}
            tableRotation={rotation}
          />
        </div>
      ))}

      {/* Table Body */}
      <div
        ref={tableBodyRef}
        style={{
          position: "absolute", left: 0, top: 0, width: tableW, height: tableH,
          background: (() => {
            if (isTableSelected) return tokens.tableSelected;
            if (!editMode) {
              if (tableStatus === "unavailable") return "rgba(184, 92, 92, 0.15)";
              if (tableStatus === "pending") return "rgba(196, 163, 90, 0.15)";
              if (tableStatus === "partial") {
                const mixColor = unavailableSeats > 0 ? "rgba(184, 92, 92, 0.15)" : "rgba(196, 163, 90, 0.15)";
                return `linear-gradient(135deg, ${tokens.tableBg} 60%, ${mixColor} 60%)`;
              }
            }
            return tokens.tableBg;
          })(),
          borderRadius: table.shape === "round" ? "50%" : table.shape === "oval" ? "50%" : 8,
          display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
          border: isTableSelected
            ? `2px solid ${tokens.gold}`
            : isColliding
              ? `2.5px solid ${C.red}`
              : !editMode && tableStatus === "unavailable"
                ? `1.5px solid ${STATUS_COLORS.unavailable}`
                : !editMode && tableStatus === "pending"
                  ? `1.5px solid ${STATUS_COLORS.pending}`
                  : hov
                    ? `1.5px solid ${tokens.borderAccent}`
                    : `1px solid ${tokens.borderDefault}`,
          boxShadow: isTableSelected
            ? `0 0 0 3px ${tokens.gold}10, 0 4px 16px rgba(0,0,0,0.12)`
            : isColliding
              ? `0 0 12px ${C.red}50, 0 4px 16px rgba(160,56,56,0.15)`
              : !editMode && (tableStatus === "unavailable" || tableStatus === "pending")
                ? "none"
                : hov
                  ? "0 4px 12px rgba(0,0,0,0.12)"
                  : tokens.cardShadow,
          transition: "border 0.15s, box-shadow 0.15s, background 0.18s",
          cursor: editMode ? (isDragging ? "grabbing" : isLocked ? "not-allowed" : "grab") : isTableBlockedForSelection ? "not-allowed" : "pointer",
          zIndex: 2,
          overflow: "visible",
          opacity: isTableBlockedForSelection ? 0.6 : 1,
        }}
        onMouseDown={editMode && !isLocked ? e => { e.stopPropagation(); onDragStart(e, table.id); } : undefined}
        onClick={e => {
          e.stopPropagation();
          if (isTableBlockedForSelection) {
            alert("This table is unavailable for the selected schedule.");
            return;
          }
          onSelectTable(table);
        }}
        onDoubleClick={editMode && !isLocked ? e => { e.stopPropagation(); setEditingLabel(true); } : undefined}
      >
        {editingLabel
          ? <div style={{ transform: `rotate(${-rotation}deg)`, transformOrigin: "center center", width: "100%", display: "flex", justifyContent: "center" }}>
            <input autoFocus value={labelVal} onChange={e => setLabelVal(e.target.value)}
              onBlur={() => { setEditingLabel(false); onLabelEdit?.(table.id, labelVal); }}
              onKeyDown={e => { if (e.key === "Enter") { setEditingLabel(false); onLabelEdit?.(table.id, labelVal); } e.stopPropagation(); }}
              onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}
              style={{ background: "transparent", border: "none", outline: "none", color: tokens.textPrimary, fontFamily: F, fontWeight: 700, fontSize: 10, letterSpacing: "0.10em", textAlign: "center", width: "85%", textTransform: "uppercase" }}
            />
          </div>
          : <>
            <div style={{
              transform: `rotate(${-rotation}deg)`,
              transformOrigin: "center center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              transition: isDragging ? "none" : "transform 0.15s ease"
            }}>
              <div style={{ color: tokens.textPrimary, fontFamily: F, fontWeight: 700, fontSize: 10, letterSpacing: "0.10em", textTransform: "uppercase", lineHeight: 1.3, textAlign: "center", padding: "0 8px" }}>
                {table.label || table.id}
              </div>
              {(table.seats?.length || 0) > 0 && (
                <div style={{ color: tokens.textTertiary, fontFamily: F, fontSize: 9, marginTop: 2 }}>
                  {table.seats.length} seats
                </div>
              )}
            </div>
            {isLocked && (
              <div style={{ position: "absolute", top: 4, right: 6, opacity: 0.5, color: tokens.gold }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
              </div>
            )}
          </>
        }
      </div>

      {/* Dimensions tooltip on hover */}
      {editMode && hov && !isDragging && (
        <div style={{ position: "absolute", bottom: -20, left: "50%", transform: "translateX(-50%)", background: "#18140E", color: "#fff", padding: "2px 6px", borderRadius: 4, fontSize: 8, fontWeight: 700, fontFamily: "monospace", pointerEvents: "none", whiteSpace: "nowrap", zIndex: 100, boxShadow: "0 2px 6px rgba(0,0,0,0.15)" }}>
          {Math.round(tableW)} × {Math.round(tableH)} cm
        </div>
      )}
    </div>
  );
}

// ─── TABLE PRESETS ────────────────────────────────────────────────────────────
export const TABLE_PRESETS = [
  { id: "small-round", label: "Small Round", shape: "round", width: 90, height: 90, defaultSeatCount: 2, minSeatCount: 0, maxSeatCount: 4, defaultSeatSpacing: 8, defaultChairStyle: "standard-dining" },
  { id: "medium-round", label: "Medium Round", shape: "round", width: 130, height: 130, defaultSeatCount: 4, minSeatCount: 0, maxSeatCount: 6, defaultSeatSpacing: 8, defaultChairStyle: "standard-dining" },
  { id: "large-round", label: "Large Round", shape: "round", width: 170, height: 170, defaultSeatCount: 8, minSeatCount: 0, maxSeatCount: 8, defaultSeatSpacing: 8, defaultChairStyle: "standard-dining" },
  { id: "extra-large-round", label: "Extra Large Round", shape: "round", width: 220, height: 220, defaultSeatCount: 10, minSeatCount: 0, maxSeatCount: 12, defaultSeatSpacing: 8, defaultChairStyle: "standard-dining" },
  { id: "small-square", label: "Small Square", shape: "square", width: 90, height: 90, defaultSeatCount: 4, minSeatCount: 0, maxSeatCount: 4, defaultSeatSpacing: 8, defaultChairStyle: "standard-dining" },
  { id: "medium-square", label: "Medium Square", shape: "square", width: 130, height: 130, defaultSeatCount: 4, minSeatCount: 0, maxSeatCount: 6, defaultSeatSpacing: 8, defaultChairStyle: "standard-dining" },
  { id: "large-square", label: "Large Square", shape: "square", width: 170, height: 170, defaultSeatCount: 8, minSeatCount: 0, maxSeatCount: 8, defaultSeatSpacing: 8, defaultChairStyle: "standard-dining" },
  { id: "two-rect", label: "2-Person Rectangle", shape: "rect", width: 90, height: 75, defaultSeatCount: 2, minSeatCount: 0, maxSeatCount: 2, defaultSeatSpacing: 8, defaultChairStyle: "standard-dining" },
  { id: "four-rect", label: "4-Person Rectangle", shape: "rect", width: 120, height: 80, defaultSeatCount: 4, minSeatCount: 0, maxSeatCount: 4, defaultSeatSpacing: 8, defaultChairStyle: "standard-dining" },
  { id: "six-rect", label: "6-Person Rectangle", shape: "rect", width: 180, height: 90, defaultSeatCount: 6, minSeatCount: 0, maxSeatCount: 6, defaultSeatSpacing: 8, defaultChairStyle: "standard-dining" },
  { id: "eight-rect", label: "8-Person Rectangle", shape: "rect", width: 240, height: 100, defaultSeatCount: 8, minSeatCount: 0, maxSeatCount: 8, defaultSeatSpacing: 8, defaultChairStyle: "standard-dining" },
  { id: "ten-rect", label: "10-Person Rectangle", shape: "rect", width: 300, height: 100, defaultSeatCount: 10, minSeatCount: 0, maxSeatCount: 10, defaultSeatSpacing: 8, defaultChairStyle: "standard-dining" },
  { id: "twelve-rect", label: "12-Person Rectangle", shape: "rect", width: 360, height: 110, defaultSeatCount: 12, minSeatCount: 0, maxSeatCount: 12, defaultSeatSpacing: 8, defaultChairStyle: "standard-dining" },
  { id: "twelve-banquet", label: "12-Person Banquet", shape: "banquet", width: 360, height: 100, defaultSeatCount: 12, minSeatCount: 0, maxSeatCount: 12, defaultSeatSpacing: 8, defaultChairStyle: "banquet-chair" },
  { id: "conference-table", label: "Conference Table", shape: "rect", width: 400, height: 120, defaultSeatCount: 14, minSeatCount: 0, maxSeatCount: 16, defaultSeatSpacing: 8, defaultChairStyle: "premium-dining" },
  { id: "cocktail-table", label: "Cocktail Table", shape: "round", width: 70, height: 70, defaultSeatCount: 0, minSeatCount: 0, maxSeatCount: 4, defaultSeatSpacing: 6, defaultChairStyle: "bar-stool" },
  { id: "bar-height-table", label: "Bar-height Table", shape: "rect", width: 150, height: 70, defaultSeatCount: 4, minSeatCount: 0, maxSeatCount: 6, defaultSeatSpacing: 8, defaultChairStyle: "bar-stool" },
  { id: "communal-dining", label: "Communal Table", shape: "rect", width: 280, height: 100, defaultSeatCount: 10, minSeatCount: 0, maxSeatCount: 12, defaultSeatSpacing: 8, defaultChairStyle: "standard-dining" },
  { id: "vip-sofa-table", label: "VIP Sofa Table", shape: "rect", width: 160, height: 90, defaultSeatCount: 6, minSeatCount: 0, maxSeatCount: 8, defaultSeatSpacing: 10, defaultChairStyle: "sofa-chair" },
  { id: "custom-table", label: "Custom Table", shape: "rect", width: 110, height: 70, defaultSeatCount: 4, minSeatCount: 0, maxSeatCount: 8, defaultSeatSpacing: 8, defaultChairStyle: "standard-dining" }
];

// ─── CHAIR STYLES ─────────────────────────────────────────────────────────────
export const CHAIR_STYLES = [
  { id: "standard-dining", label: "Standard Dining Chair", width: 38, depth: 38, spacingMultiplier: 1.0 },
  { id: "premium-dining", label: "Premium Dining Chair", width: 42, depth: 42, spacingMultiplier: 1.1 },
  { id: "high-chair", label: "High Chair", width: 34, depth: 34, spacingMultiplier: 0.9 },
  { id: "bar-stool", label: "Bar Stool", width: 34, depth: 34, spacingMultiplier: 0.8 },
  { id: "arm-chair", label: "Arm Chair", width: 46, depth: 46, spacingMultiplier: 1.2 },
  { id: "banquet-chair", label: "Banquet Chair", width: 40, depth: 40, spacingMultiplier: 1.0 },
  { id: "sofa-chair", label: "Sofa Chair", width: 55, depth: 50, spacingMultiplier: 1.3 },
  { id: "bench-seat", label: "Bench Seat", width: 120, depth: 36, spacingMultiplier: 1.0, isBench: true },
  { id: "lounge-chair", label: "Lounge Chair", width: 50, depth: 50, spacingMultiplier: 1.25 },
  { id: "vip-chair", label: "VIP Chair", width: 48, depth: 48, spacingMultiplier: 1.2 },
  { id: "child-chair", label: "Child Chair", width: 32, depth: 32, spacingMultiplier: 0.85 },
  { id: "custom-chair", label: "Custom Chair", width: 38, depth: 38, spacingMultiplier: 1.0 }
];

// ─── FIXTURE PRESETS ──────────────────────────────────────────────────────────
export const FIXTURE_PRESETS = [
  { id: "host-stand", label: "Host Stand", fixture_type: "host-stand", width: 50, height: 50 },
  { id: "reception-desk", label: "Reception Desk", fixture_type: "reception-desk", width: 150, height: 75 },
  { id: "buffet-table", label: "Buffet Table", fixture_type: "buffet-table", width: 240, height: 90 },
  { id: "bar-counter", label: "Bar Counter", fixture_type: "bar-counter", width: 300, height: 80 },
  { id: "service-station", label: "Service Station", fixture_type: "service-station", width: 120, height: 60 },
  { id: "pos-station", label: "POS Station", fixture_type: "pos-station", width: 60, height: 60 },
  { id: "waiter-station", label: "Waiter Station", fixture_type: "waiter-station", width: 100, height: 60 },
  { id: "divider", label: "Divider", fixture_type: "divider", width: 120, height: 15 },
  { id: "partition-wall", label: "Partition Wall", fixture_type: "partition-wall", width: 240, height: 20 },
  { id: "stage", label: "Stage", fixture_type: "stage", width: 400, height: 240 },
  { id: "dance-floor", label: "Dance Floor", fixture_type: "dance-floor", width: 300, height: 300 },
  { id: "screen", label: "Screen", fixture_type: "screen", width: 180, height: 15 },
  { id: "projector", label: "Projector", fixture_type: "projector", width: 40, height: 40 },
  { id: "podium", label: "Podium", fixture_type: "podium", width: 60, height: 50 },
  { id: "entrance", label: "Entrance", fixture_type: "entrance", width: 100, height: 20 },
  { id: "exit", label: "Exit", fixture_type: "exit", width: 100, height: 20 },
  { id: "emergency-exit", label: "Emergency Exit", fixture_type: "emergency-exit", width: 100, height: 20 },
  { id: "restroom-marker", label: "Restroom Marker", fixture_type: "restroom-marker", width: 60, height: 60 },
  { id: "kitchen-door", label: "Kitchen Door", fixture_type: "kitchen-door", width: 100, height: 15 },
  { id: "pillar-column", label: "Pillar / Column", fixture_type: "pillar-column", width: 50, height: 50 },
  { id: "plant-decor", label: "Plant / Decor", fixture_type: "plant-decor", width: 40, height: 40 },
  { id: "sofa", label: "Sofa", fixture_type: "sofa", width: 180, height: 80 },
  { id: "bench", label: "Bench", fixture_type: "bench", width: 150, height: 45 },
  { id: "cabinet", label: "Cabinet", fixture_type: "cabinet", width: 120, height: 45 },
  { id: "av-booth", label: "AV Booth", fixture_type: "av-booth", width: 150, height: 150 },
  { id: "custom-object", label: "Custom Object", fixture_type: "custom-object", width: 100, height: 100 }
];

export const STANDALONE_CHAIR_PRESETS = [
  { id: "std-chair", label: "Standard Chair", chair_style: "standard-standalone", width: 38, height: 38 },
  { id: "prem-chair", label: "Premium Chair", chair_style: "premium-standalone", width: 42, height: 42 },
  { id: "high-chair-sa", label: "High Chair", chair_style: "high-chair", width: 34, height: 34 },
  { id: "bar-stool-sa", label: "Bar Stool", chair_style: "bar-stool", width: 34, height: 34 },
  { id: "lounge-chair-sa", label: "Lounge Chair", chair_style: "lounge-chair", width: 50, height: 50 },
  { id: "arm-chair-sa", label: "Arm Chair", chair_style: "arm-chair", width: 46, height: 46 },
  { id: "sofa-seat-sa", label: "Sofa Seat", chair_style: "sofa-seat", width: 55, height: 50 },
  { id: "bench-seat-sa", label: "Bench Seat", chair_style: "bench-seat", width: 80, height: 38 },
  { id: "child-chair-sa", label: "Child Chair", chair_style: "child-chair", width: 32, height: 32 },
  { id: "vip-chair-sa", label: "VIP Chair", chair_style: "vip-chair", width: 46, height: 46 }
];

export const DISPLAY_PRESETS = [
  { id: "projection-screen", label: "Projection Screen", fixture_type: "projection-screen", width: 180, height: 15 },
  { id: "small-tv", label: "Small TV", fixture_type: "small-tv", width: 80, height: 15 },
  { id: "medium-tv", label: "Medium TV", fixture_type: "medium-tv", width: 120, height: 15 },
  { id: "large-tv", label: "Large TV", fixture_type: "large-tv", width: 160, height: 15 },
  { id: "extra-large-tv", label: "Extra Large TV", fixture_type: "extra-large-tv", width: 200, height: 15 },
  { id: "led-wall", label: "LED Wall", fixture_type: "led-wall", width: 300, height: 20 },
  { id: "projector", label: "Projector", fixture_type: "projector", width: 40, height: 40 },
  { id: "monitor-stand", label: "Monitor Stand", fixture_type: "monitor-stand", width: 60, height: 40 }
];

export const AIRFLOW_PRESETS = [
  { id: "wall-fan", label: "Wall Fan", fixture_type: "wall-fan", width: 40, height: 40 },
  { id: "stand-fan", label: "Stand Fan", fixture_type: "stand-fan", width: 40, height: 40 },
  { id: "ceiling-fan", label: "Ceiling Fan", fixture_type: "ceiling-fan", width: 50, height: 50 },
  { id: "industrial-fan", label: "Industrial Fan", fixture_type: "industrial-fan", width: 60, height: 60 },
  { id: "aircon-unit", label: "Aircon Unit", fixture_type: "aircon-unit", width: 100, height: 35 },
  { id: "vent-marker", label: "Vent Marker", fixture_type: "vent-marker", width: 40, height: 40 }
];

export const ENTRANCE_PRESETS = [
  { id: "main-entrance", label: "Main Entrance", fixture_type: "main-entrance", width: 100, height: 20 },
  { id: "side-entrance", label: "Side Entrance", fixture_type: "side-entrance", width: 80, height: 20 },
  { id: "service-entrance", label: "Service Entrance", fixture_type: "service-entrance", width: 80, height: 20 },
  { id: "exit-sa", label: "Exit", fixture_type: "exit", width: 100, height: 20 },
  { id: "emergency-exit-sa", label: "Emergency Exit", fixture_type: "emergency-exit", width: 100, height: 20 },
  { id: "fire-exit-sa", label: "Fire Exit", fixture_type: "fire-exit", width: 100, height: 20 },
  { id: "staff-only-door", label: "Staff-only Door", fixture_type: "staff-only-door", width: 80, height: 20 },
  { id: "kitchen-door-sa", label: "Kitchen Door", fixture_type: "kitchen-door", width: 80, height: 20 }
];

export const WALL_PRESETS = [
  { id: "straight-wall", label: "Straight Wall", fixture_type: "straight-wall", width: 240, height: 10, thickness: 8 },
  { id: "curved-wall", label: "Curved Wall", fixture_type: "curved-wall", width: 240, height: 60, thickness: 8, curve_strength: 50 },
  { id: "partition-wall-sa", label: "Partition Wall", fixture_type: "partition-wall", width: 200, height: 15 },
  { id: "glass-divider", label: "Glass Divider", fixture_type: "glass-divider", width: 180, height: 10 },
  { id: "movable-divider", label: "Movable Divider", fixture_type: "movable-divider", width: 150, height: 15 },
  { id: "half-wall", label: "Half Wall", fixture_type: "half-wall", width: 160, height: 12 },
  { id: "room-boundary-segment", label: "Room Boundary", fixture_type: "room-boundary-segment", width: 300, height: 15 }
];

function makeTableFromPreset(preset, x = 120, y = 80) {
  const id = `T${_tableCounter++}`;
  const seatCount = preset.defaultSeatCount;
  return {
    id,
    label: preset.label + " " + id,
    x,
    y,
    shape: preset.shape === "rectangle" ? "rect" : preset.shape,
    width: preset.width,
    height: preset.height,
    seats: Array.from({ length: seatCount }, (_, i) => ({
      id: `${id}-S${i + 1}`,
      num: i + 1,
      label: `S${i + 1}`,
      status: "available"
    })),
    editor: {
      preset_id: preset.id,
      rotation: 0,
      chair_style: preset.defaultChairStyle || "standard-dining",
      seat_spacing_cm: preset.defaultSeatSpacing || 8,
      min_capacity: preset.minSeatCount ?? 0,
      max_capacity: preset.maxSeatCount ?? seatCount,
      locked: false
    }
  };
}

function makeFixtureFromPreset(preset, x = 100, y = 100) {
  const id = `FX${_fixtureCounter++}`;
  return {
    id,
    type: "fixture",
    fixture_type: preset.fixture_type,
    label: preset.label,
    x,
    y,
    width: preset.width,
    height: preset.height,
    editor: {
      rotation: 0,
      locked: false,
      reservable: false,
      mounting_style: preset.fixture_type?.includes("tv") || preset.fixture_type?.includes("screen") ? "wall-mounted" : undefined,
      thickness: preset.thickness || (preset.fixture_type?.includes("wall") || preset.fixture_type?.includes("divider") ? 8 : undefined),
      curve_strength: preset.curve_strength || (preset.fixture_type === "curved-wall" ? 50 : undefined)
    }
  };
}

// ─── FIXTURE NODE ─────────────────────────────────────────────────────────────
function FixtureNode({ fixture, editMode, isSelected, onSelect, onDragStart, isDragging, T }) {
  const [hov, setHov] = useState(false);
  const w = fixture.width || 80;
  const h = fixture.height || 60;
  const rotation = fixture.editor?.rotation || 0;
  const isLocked = fixture.editor?.locked || false;

  const normRot = ((rotation % 360) + 360) % 360;
  const shouldFlip = normRot > 90 && normRot < 270;
  const textTransform = shouldFlip ? "rotate(180deg)" : "none";

  const tokens = T || {
    gold: C.gold, borderDefault: C.borderDefault, borderAccent: C.borderAccent,
    textPrimary: C.textPrimary, textTertiary: C.textTertiary, cardShadow: C.cardShadow
  };

  const isWall = [
    "straight-wall", "curved-wall", "partition-wall", "glass-divider",
    "movable-divider", "half-wall", "room-boundary-segment"
  ].includes(fixture.fixture_type);

  // Determine wall color
  const wallColors = {
    "straight-wall": "#5E5647",
    "partition-wall": "#8A8278",
    "glass-divider": "rgba(173, 230, 240, 0.70)",
    "movable-divider": "rgba(196, 163, 90, 0.30)",
    "half-wall": "#A89F90",
    "room-boundary-segment": "#22201C"
  };
  const wallColor = wallColors[fixture.fixture_type] || "#5E5647";
  const thickness = fixture.editor?.thickness || 8;

  if (isWall) {
    if (fixture.fixture_type === "curved-wall") {
      const curveStrength = fixture.editor?.curve_strength || 40;
      const pathD = `M ${thickness / 2},${h - thickness / 2} Q ${w / 2},${h - curveStrength - thickness / 2} ${w - thickness / 2},${h - thickness / 2}`;
      return (
        <div
          style={{
            position: "absolute",
            left: fixture.x || 0,
            top: fixture.y || 0,
            width: w,
            height: h,
            transform: `rotate(${rotation}deg)`,
            transformOrigin: "center center",
            zIndex: isSelected ? 10 : 2, // sits behind tables (which have zIndex 4+)
            transition: isDragging ? "none" : "transform 0.15s ease",
          }}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          onClick={e => { e.stopPropagation(); onSelect(fixture); }}
          onMouseDown={editMode && !isLocked ? e => { e.stopPropagation(); onDragStart(e, fixture.id); } : undefined}
        >
          <svg style={{ width: "100%", height: "100%", overflow: "visible" }}>
            <path d={pathD} fill="none" stroke={wallColor} strokeWidth={thickness} strokeLinecap="round" />
            {isSelected && (
              <path d={pathD} fill="none" stroke={tokens.gold} strokeWidth={thickness + 4} strokeLinecap="round" strokeDasharray="4 4" opacity={0.5} />
            )}
          </svg>
          {isSelected && (
            <div style={{ position: "absolute", inset: -2, border: `1.5px dashed ${tokens.gold}`, borderRadius: 4, pointerEvents: "none" }} />
          )}
        </div>
      );
    } else {
      // Straight walls: render a solid bar!
      return (
        <div
          style={{
            position: "absolute",
            left: fixture.x || 0,
            top: fixture.y || 0,
            width: w,
            height: h,
            transform: `rotate(${rotation}deg)`,
            transformOrigin: "center center",
            zIndex: isSelected ? 10 : 2, // sits behind tables
            transition: isDragging ? "none" : "transform 0.15s ease",
          }}
          onMouseEnter={() => setHov(true)}
          onMouseLeave={() => setHov(false)}
          onClick={e => { e.stopPropagation(); onSelect(fixture); }}
          onMouseDown={editMode && !isLocked ? e => { e.stopPropagation(); onDragStart(e, fixture.id); } : undefined}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              background: wallColor,
              borderRadius: fixture.fixture_type === "glass-divider" ? 2 : 1,
              border: isSelected ? `2.5px solid ${tokens.gold}` : hov ? `1.5px solid ${tokens.borderAccent}` : "none",
              boxShadow: isSelected ? "0 4px 16px rgba(0,0,0,0.10)" : "none",
              cursor: editMode ? (isDragging ? "grabbing" : isLocked ? "not-allowed" : "grab") : "default",
              transition: "all 0.15s ease",
            }}
          />
        </div>
      );
    }
  }

  // Render Display TV glossy bezel
  const isDisplay = ["projection-screen", "small-tv", "medium-tv", "large-tv", "extra-large-tv", "led-wall"].includes(fixture.fixture_type);
  if (isDisplay) {
    const mountingStyle = fixture.editor?.mounting_style || "wall-mounted";
    return (
      <div
        style={{
          position: "absolute",
          left: fixture.x || 0,
          top: fixture.y || 0,
          width: w,
          height: h,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "center center",
          zIndex: isSelected ? 10 : 3,
          transition: isDragging ? "none" : "transform 0.15s ease",
        }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={e => { e.stopPropagation(); onSelect(fixture); }}
        onMouseDown={editMode && !isLocked ? e => { e.stopPropagation(); onDragStart(e, fixture.id); } : undefined}
      >
        <div style={{
          width: "100%", height: "100%",
          background: "#18140E",
          border: isSelected ? `2px solid ${tokens.gold}` : `1px solid rgba(255,255,255,0.25)`,
          borderRadius: 3,
          boxShadow: "0 6px 20px rgba(0,0,0,0.30)",
          display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
          cursor: editMode ? (isDragging ? "grabbing" : isLocked ? "not-allowed" : "grab") : "default",
          position: "relative", overflow: "hidden"
        }}>
          {/* Glass glare effect */}
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "50%", background: "linear-gradient(to bottom, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0) 100%)", pointerEvents: "none" }} />
          <span style={{ fontSize: 8, fontWeight: 800, color: tokens.gold, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "0 4px", transform: textTransform, display: "inline-block" }}>
            {fixture.label}
          </span>
          <span style={{ fontSize: 6, color: "rgba(255,255,255,0.40)", textTransform: "uppercase", marginTop: 2, transform: textTransform, display: "inline-block" }}>
            {mountingStyle}
          </span>
        </div>
      </div>
    );
  }

  // Render Doors / Entrances / Exits with CAD-style door swing!
  const isDoor = ["entrance", "exit", "emergency-exit", "fire-exit", "main-entrance", "side-entrance", "service-entrance", "staff-only-door", "kitchen-door"].includes(fixture.fixture_type);
  if (isDoor) {
    return (
      <div
        style={{
          position: "absolute",
          left: fixture.x || 0,
          top: fixture.y || 0,
          width: w,
          height: h,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "center center",
          zIndex: isSelected ? 10 : 3,
          transition: isDragging ? "none" : "transform 0.15s ease",
        }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={e => { e.stopPropagation(); onSelect(fixture); }}
        onMouseDown={editMode && !isLocked ? e => { e.stopPropagation(); onDragStart(e, fixture.id); } : undefined}
      >
        <div style={{
          width: "100%", height: "100%",
          background: isSelected ? "rgba(196,163,90,0.08)" : "transparent",
          border: isSelected ? `2.5px solid ${tokens.gold}` : hov ? `1.5px solid ${tokens.borderAccent}` : "none",
          cursor: editMode ? (isDragging ? "grabbing" : isLocked ? "not-allowed" : "grab") : "default",
          position: "relative"
        }}>
          {/* CAD Door Swing SVG */}
          <svg style={{ width: "100%", height: "100%", overflow: "visible" }}>
            {/* Wall base segment */}
            <line x1={0} y1={h} x2={w} y2={h} stroke="#8A8278" strokeWidth={3} />
            {/* Door Panel */}
            <line x1={0} y1={h} x2={0} y2={0} stroke={C.gold} strokeWidth={2} />
            {/* Dashed Swing Arc */}
            <path d={`M 0,0 A ${h},${h} 0 0,1 ${w},${h}`} fill="none" stroke={C.gold} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
          </svg>
          <div style={{ position: "absolute", bottom: -2, left: 4, fontSize: 7, fontWeight: 800, color: tokens.gold, textTransform: "uppercase", transform: textTransform, transformOrigin: "center center", display: "inline-block" }}>
            {fixture.label}
          </div>
        </div>
      </div>
    );
  }

  // Render Airflow / Ceiling fans with blades overlay!
  const isAirflow = ["wall-fan", "stand-fan", "ceiling-fan", "industrial-fan", "aircon-unit", "vent-marker"].includes(fixture.fixture_type);
  if (isAirflow) {
    const isFan = fixture.fixture_type.includes("fan");
    return (
      <div
        style={{
          position: "absolute",
          left: fixture.x || 0,
          top: fixture.y || 0,
          width: w,
          height: h,
          transform: `rotate(${rotation}deg)`,
          transformOrigin: "center center",
          zIndex: isSelected ? 10 : 3,
          transition: isDragging ? "none" : "transform 0.15s ease",
          display: "flex", alignItems: "center", justifyContent: "center"
        }}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        onClick={e => { e.stopPropagation(); onSelect(fixture); }}
        onMouseDown={editMode && !isLocked ? e => { e.stopPropagation(); onDragStart(e, fixture.id); } : undefined}
      >
        <div style={{
          width: w, height: h,
          background: isSelected ? "rgba(196,163,90,0.06)" : "#FAF8F4",
          border: isSelected
            ? `2px solid ${tokens.gold}`
            : hov
              ? `1.5px solid ${tokens.borderAccent}`
              : `1px solid ${tokens.borderDefault}`,
          borderRadius: isFan ? "50%" : 4,
          boxShadow: tokens.cardShadow,
          display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
          cursor: editMode ? (isDragging ? "grabbing" : isLocked ? "not-allowed" : "grab") : "default",
          position: "relative"
        }}>
          {isFan ? (
            <svg style={{ width: "80%", height: "80%", overflow: "visible", opacity: 0.40, animation: "sm-spin 8s linear infinite" }}>
              <circle cx="50%" cy="50%" r={4} fill="#8A8278" />
              <line x1="50%" y1="50%" x2="50%" y2="0" stroke="#8A8278" strokeWidth={3} strokeLinecap="round" />
              <line x1="50%" y1="50%" x2="10%" y2="75%" stroke="#8A8278" strokeWidth={3} strokeLinecap="round" />
              <line x1="50%" y1="50%" x2="90%" y2="75%" stroke="#8A8278" strokeWidth={3} strokeLinecap="round" />
            </svg>
          ) : (
            <div style={{ display: "flex", gap: 3, width: "100%", justifyContent: "center", padding: "0 6px" }}>
              <span style={{ width: 3, height: 12, background: C.gold, borderRadius: 1 }} />
              <span style={{ width: 3, height: 12, background: C.gold, borderRadius: 1 }} />
              <span style={{ width: 3, height: 12, background: C.gold, borderRadius: 1 }} />
            </div>
          )}
          <span style={{ fontSize: 7, fontWeight: 800, color: tokens.textPrimary, textTransform: "uppercase", position: "absolute", bottom: 2, transform: textTransform, display: "inline-block" }}>
            {fixture.label}
          </span>
        </div>
      </div>
    );
  }

  // Fallback to original architectural fixture visual style
  return (
    <div
      style={{
        position: "absolute",
        left: fixture.x || 0,
        top: fixture.y || 0,
        width: w,
        height: h,
        transform: `rotate(${rotation}deg)`,
        transformOrigin: "center center",
        zIndex: isSelected ? 10 : 3,
        transition: isDragging ? "none" : "transform 0.15s ease",
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={e => {
        e.stopPropagation();
        onSelect(fixture);
      }}
      onMouseDown={editMode && !isLocked ? e => { e.stopPropagation(); onDragStart(e, fixture.id); } : undefined}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          background: isSelected ? "rgba(140,107,42,0.06)" : "#F2EFE9",
          border: isSelected
            ? `2px solid ${tokens.gold}`
            : hov
              ? `1.5px solid ${tokens.borderAccent}`
              : `1px solid ${tokens.borderDefault}`,
          borderRadius: fixture.fixture_type === "pillar-column" ? "50%" : 4,
          boxShadow: isSelected ? "0 4px 16px rgba(0,0,0,0.10)" : tokens.cardShadow,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexDirection: "column",
          cursor: editMode ? (isDragging ? "grabbing" : isLocked ? "not-allowed" : "grab") : "default",
          transition: "all 0.15s ease",
          position: "relative",
          overflow: "hidden"
        }}
      >
        <div style={{ position: "absolute", inset: 0, opacity: 0.05, pointerEvents: "none" }}>
          <svg width="100%" height="100%">
            <line x1={0} y1={0} x2="100%" y2="100%" stroke="#000" strokeWidth={0.5} />
            <line x1="100%" y1={0} x2={0} y2="100%" stroke="#000" strokeWidth={0.5} />
          </svg>
        </div>
        <span style={{ fontSize: 9, fontWeight: 700, color: tokens.textPrimary, textTransform: "uppercase", letterSpacing: "0.05em", textAlign: "center", padding: "0 6px", transform: textTransform, display: "inline-block" }}>
          {fixture.label || fixture.id}
        </span>
      </div>
      {isLocked && (
        <div style={{ position: "absolute", top: 4, right: 6, opacity: 0.5, color: tokens.gold }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
        </div>
      )}
    </div>
  );
}
function LeftSidebarPanel({
  activeWing, activeRoom, onSelect, venueStructure, onOpenVenueManager,
  addTablePreset, addFixturePreset, addLabelPreset, addStandaloneSeatPreset
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [roomsExpanded, setRoomsExpanded] = useState(true);
  const [diningExpanded, setDiningExpanded] = useState(true);
  const [architectureExpanded, setArchitectureExpanded] = useState(false);
  const [fixturesExpanded, setFixturesExpanded] = useState(false);
  const [annotationsExpanded, setAnnotationsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState("rooms"); // "rooms" or "library"

  const [subsExpanded, setSubsExpanded] = useState({
    tables: true,
    chairs: true,
    walls: true,
    doors: true,
    displays: true,
    airflow: true,
    fixtures: true,
    labels: true
  });
  const toggleSub = (key) => setSubsExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const [wingsExpanded, setWingsExpanded] = useState(() =>
    Object.fromEntries(venueStructure.map(w => [w.id, true]))
  );

  const toggleWing = id => setWingsExpanded(e => ({ ...e, [id]: !e[id] }));

  useEffect(() => {
    setWingsExpanded(prev => {
      const next = { ...prev };
      venueStructure.forEach(w => { if (!(w.id in next)) next[w.id] = true; });
      return next;
    });
  }, [venueStructure]);

  const presetButtonStyle = {
    width: "100%",
    padding: "7px 10px",
    background: "transparent",
    border: `1px solid ${C.borderDefault}`,
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    gap: 8,
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.13s",
    boxSizing: "border-box"
  };

  const rowStyle = (active) => ({
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 14px 6px 24px",
    cursor: "pointer",
    background: active ? C.goldFaint : "transparent",
    borderLeft: `3px solid ${active ? C.gold : "transparent"}`,
    transition: "all 0.14s",
  });

  const LABEL_PRESETS = [
    { id: "text-label", label: "Text Label", type: "screen", defaultText: "DRAFT AREA" },
    { id: "vip-section", label: "VIP Section Marker", type: "other", defaultText: "VIP SECTION" },
    { id: "direction-arrow", label: "Measurement Label", type: "other", defaultText: "10m PADDING" }
  ];

  const filterPresets = (presets) => {
    if (!searchQuery) return presets;
    const q = searchQuery.toLowerCase().trim();
    return presets.filter(p =>
      (p.label && p.label.toLowerCase().includes(q)) ||
      (p.id && p.id.toLowerCase().includes(q)) ||
      (p.fixture_type && p.fixture_type.toLowerCase().includes(q))
    );
  };

  const filteredTables = filterPresets(TABLE_PRESETS);
  const filteredChairs = filterPresets(STANDALONE_CHAIR_PRESETS);
  const filteredWalls = filterPresets(WALL_PRESETS);
  const filteredDoors = filterPresets(ENTRANCE_PRESETS);
  const filteredDisplays = filterPresets(DISPLAY_PRESETS);
  const filteredAirflow = filterPresets(AIRFLOW_PRESETS);
  const filteredFixtures = filterPresets(FIXTURE_PRESETS);
  const filteredLabels = filterPresets(LABEL_PRESETS);

  const hasAnyMatches = filteredTables.length > 0 || filteredChairs.length > 0 ||
    filteredWalls.length > 0 || filteredDoors.length > 0 ||
    filteredDisplays.length > 0 || filteredAirflow.length > 0 ||
    filteredFixtures.length > 0 || filteredLabels.length > 0;

  const isDiningOpen = searchQuery ? true : diningExpanded;
  const isArchitectureOpen = searchQuery ? true : architectureExpanded;
  const isFixturesOpen = searchQuery ? true : fixturesExpanded;
  const isAnnotationsOpen = searchQuery ? true : annotationsExpanded;

  const CategoryHeader = ({ title, isOpen, onClick, count }) => {
    const [hov, setHov] = useState(false);
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "9px 14px",
          borderBottom: `1px solid ${C.divider}`,
          background: hov ? C.goldFaintest : C.surfaceRaised,
          cursor: "pointer",
          userSelect: "none",
          transition: "background 0.15s ease"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.gold}
            strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"
            style={{
              transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
              transition: "transform 0.15s",
            }}
          >
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
          <span style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: "0.08em",
            color: C.textPrimary,
            textTransform: "uppercase",
            fontFamily: F
          }}>{title}</span>
        </div>
        {count !== undefined && count > 0 && (
          <span style={{ fontSize: 8, fontWeight: 700, color: C.gold, fontFamily: F, background: C.goldFaint, padding: "2px 6px", borderRadius: 10 }}>
            {count}
          </span>
        )}
      </div>
    );
  };

  const SubSectionHeader = ({ title, isOpen, onClick }) => {
    const [hovered, setHovered] = useState(false);
    return (
      <div
        onClick={onClick}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginTop: 6,
          marginBottom: 6,
          padding: "8px 10px",
          background: hovered ? "rgba(140, 107, 42, 0.08)" : "rgba(0,0,0,0.02)",
          border: `1px solid ${hovered ? C.goldFaint : C.borderDefault}`,
          borderRadius: 6,
          cursor: "pointer",
          userSelect: "none",
          transition: "all 0.15s ease"
        }}
      >
        <div style={{
          fontSize: 9,
          fontWeight: 750,
          letterSpacing: "0.06em",
          color: hovered ? C.gold : C.textSecondary,
          textTransform: "uppercase",
          fontFamily: F,
          transition: "color 0.15s"
        }}>{title}</div>
        <svg
          width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={hovered ? C.gold : C.textTertiary}
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
          style={{
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            transition: "all 0.2s ease"
          }}
        >
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </div>
    );
  };

  return (
    <div className="sm-scroll" style={{ width: 240, flexShrink: 0, alignSelf: "stretch", background: C.sidebarBg, borderRight: `1px solid ${C.sidebarBorder}`, display: "flex", flexDirection: "column", overflow: "hidden", userSelect: "none" }}>

      {/* SEGMENTED TAB CONTROL */}
      <div style={{ padding: "12px 14px 10px", background: C.surfaceRaised, borderBottom: `1px solid ${C.divider}`, zIndex: 10, flexShrink: 0 }}>
        <div style={{ display: "flex", background: "rgba(0,0,0,0.04)", borderRadius: 8, padding: 3, border: `1px solid ${C.borderDefault}` }}>
          <button
            onClick={() => setActiveTab("rooms")}
            style={{
              flex: 1, padding: "6px 0", border: "none", borderRadius: 6, cursor: "pointer",
              fontFamily: F, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              transition: "all 0.15s",
              background: activeTab === "rooms" ? C.surfaceBase : "transparent",
              color: activeTab === "rooms" ? C.gold : C.textSecondary,
              boxShadow: activeTab === "rooms" ? C.cardShadow : "none"
            }}
          >
            Rooms
          </button>
          <button
            onClick={() => setActiveTab("library")}
            style={{
              flex: 1, padding: "6px 0", border: "none", borderRadius: 6, cursor: "pointer",
              fontFamily: F, fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase",
              transition: "all 0.15s",
              background: activeTab === "library" ? C.surfaceBase : "transparent",
              color: activeTab === "library" ? C.gold : C.textSecondary,
              boxShadow: activeTab === "library" ? C.cardShadow : "none"
            }}
          >
            Library
          </button>
        </div>
      </div>

      <div className="sm-scroll" style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>

        {/* 1. ROOM NAVIGATOR */}
        {activeTab === "rooms" && (
          <div style={{ display: "flex", flexDirection: "column", paddingBottom: 10 }}>
            {/* Current Context Badge */}
            <div style={{ padding: "14px 14px 10px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2, padding: "8px 10px", background: "rgba(140, 107, 42, 0.05)", borderRadius: 6, border: `1px solid ${C.borderAccent}` }}>
                <div style={{ fontSize: 7, color: C.textTertiary, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>Active Venue Context</div>
                <div style={{ fontSize: 10, fontWeight: 700, color: C.textPrimary, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontFamily: F }}>
                  {activeWing} • {activeRoom}
                </div>
              </div>
            </div>

            {/* Wing Room groups */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {venueStructure.map((wing) => (
                <div key={wing.id}>
                  <div
                    style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 14px", cursor: "pointer", userSelect: "none", transition: "background 0.14s" }}
                    onClick={() => toggleWing(wing.id)}
                    onMouseEnter={e => e.currentTarget.style.background = C.goldFaintest}
                    onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: wingsExpanded[wing.id] ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.18s", flexShrink: 0 }}>
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: C.textPrimary, textTransform: "uppercase", fontFamily: F }}>{wing.label}</span>
                    </div>
                    <span style={{ fontSize: 8, fontWeight: 600, color: C.textTertiary, fontFamily: F, background: "rgba(0,0,0,0.03)", padding: "1px 5px", borderRadius: 4 }}>{wing.rooms.length}</span>
                  </div>

                  {wingsExpanded[wing.id] && (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {wing.rooms.map((room, roomIndex) => {
                        const active = activeWing === wing.label && activeRoom === room;
                        return (
                          <div
                            key={`${wing.id}-${roomIndex}-${room}`}
                            onClick={() => onSelect(wing.label, room)}
                            style={rowStyle(active)}
                            onMouseEnter={e => { if (!active) e.currentTarget.style.background = C.goldFaintest; }}
                            onMouseLeave={e => { if (!active) e.currentTarget.style.background = "transparent"; }}
                          >
                            <span style={{ fontSize: 10, color: active ? C.gold : C.textSecondary, fontFamily: F, fontWeight: active ? 700 : 400, lineHeight: 1.4, flex: 1, transition: "color 0.14s" }}>
                              {room}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Manage Venue Button */}
            {onOpenVenueManager && (
              <div style={{ padding: "10px 14px 0", flexShrink: 0 }}>
                <button onClick={onOpenVenueManager}
                  style={{ width: "100%", padding: "7px 0", background: C.goldFaintest, border: `1px solid ${C.borderAccent}`, borderRadius: 6, fontFamily: F, fontSize: 8, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: C.gold, cursor: "pointer", transition: "all 0.15s", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
                  onMouseEnter={e => { e.currentTarget.style.background = C.goldFaint; }}
                  onMouseLeave={e => { e.currentTarget.style.background = C.goldFaintest; }}>
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
                  Manage Venue
                </button>
              </div>
            )}
          </div>
        )}

        {/* 2. STUDIO LIBRARY */}
        {activeTab === "library" && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 14px 10px" }}>

              {/* Search input bar */}
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Search objects..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 10px 6px 26px",
                    border: `1px solid ${C.borderDefault}`,
                    borderRadius: 6,
                    fontSize: 10,
                    color: C.textPrimary,
                    background: C.surfaceInput,
                    fontFamily: F,
                    outline: "none",
                    boxSizing: "border-box",
                    transition: "all 0.15s"
                  }}
                  onFocus={e => { e.target.style.borderColor = C.borderAccent; e.target.style.boxShadow = C.inputFocus; }}
                  onBlur={e => { e.target.style.borderColor = C.borderDefault; e.target.style.boxShadow = "none"; }}
                />
                <span style={{ position: "absolute", left: 8, top: "50%", transform: "translateY(-50%)", fontSize: 10, pointerEvents: "none", opacity: 0.6 }}>🔍</span>
              </div>
            </div>

            {/* Categories accordion */}
            <div style={{ display: "flex", flexDirection: "column" }}>

              {/* A. Dining */}
              {(filteredTables.length > 0 || filteredChairs.length > 0) && (
                <div>
                  <CategoryHeader
                    title="Dining"
                    isOpen={isDiningOpen}
                    onClick={() => setDiningExpanded(!diningExpanded)}
                    count={filteredTables.length + filteredChairs.length}
                  />
                  {isDiningOpen && (
                    <div style={{ padding: "6px 12px 12px", display: "flex", flexDirection: "column", gap: 8, borderBottom: `1px solid ${C.divider}` }}>
                      {filteredTables.length > 0 && (
                        <div>
                          <SubSectionHeader title="Table Presets" isOpen={searchQuery || subsExpanded.tables} onClick={() => toggleSub("tables")} />
                          {(searchQuery || subsExpanded.tables) && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {filteredTables.map(preset => (
                                <button
                                  key={preset.id}
                                  onClick={() => addTablePreset(preset)}
                                  draggable={true}
                                  onDragStart={e => {
                                    e.dataTransfer.setData("application/react-preset", JSON.stringify({ preset, presetType: "table" }));
                                    e.dataTransfer.effectAllowed = "copy";
                                  }}
                                  style={presetButtonStyle}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.background = C.goldFaintest; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.background = "transparent"; }}
                                >
                                  <div style={{ width: 12, height: 12, borderRadius: preset.shape === "round" ? "50%" : 2, border: `1.5px solid ${C.gold}`, background: "transparent", flexShrink: 0 }} />
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: C.textPrimary, fontFamily: F }}>{preset.label}</div>
                                    <div style={{ fontSize: 8, color: C.textTertiary, fontFamily: F }}>{preset.defaultSeatCount} seats · {preset.width}x{preset.height}cm</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {filteredChairs.length > 0 && (
                        <div style={{ marginTop: filteredTables.length > 0 ? 6 : 0 }}>
                          <SubSectionHeader title="Standalone Chairs" isOpen={searchQuery || subsExpanded.chairs} onClick={() => toggleSub("chairs")} />
                          {(searchQuery || subsExpanded.chairs) && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {filteredChairs.map(preset => (
                                <button
                                  key={preset.id}
                                  onClick={() => addStandaloneSeatPreset(preset)}
                                  draggable={true}
                                  onDragStart={e => {
                                    e.dataTransfer.setData("application/react-preset", JSON.stringify({ preset, presetType: "standaloneSeat" }));
                                    e.dataTransfer.effectAllowed = "copy";
                                  }}
                                  style={presetButtonStyle}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.background = C.goldFaintest; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.background = "transparent"; }}
                                >
                                  <div style={{ width: 12, height: 12, borderRadius: "50%", border: `1.5px solid ${C.gold}`, background: C.goldFaint, flexShrink: 0 }} />
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: C.textPrimary, fontFamily: F }}>{preset.label}</div>
                                    <div style={{ fontSize: 8, color: C.textTertiary, fontFamily: F }}>{preset.width} × {preset.height} cm</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* B. Architecture */}
              {(filteredWalls.length > 0 || filteredDoors.length > 0) && (
                <div>
                  <CategoryHeader
                    title="Architecture"
                    isOpen={isArchitectureOpen}
                    onClick={() => setArchitectureExpanded(!architectureExpanded)}
                    count={filteredWalls.length + filteredDoors.length}
                  />
                  {isArchitectureOpen && (
                    <div style={{ padding: "6px 12px 12px", display: "flex", flexDirection: "column", gap: 8, borderBottom: `1px solid ${C.divider}` }}>
                      {filteredWalls.length > 0 && (
                        <div>
                          <SubSectionHeader title="Walls &amp; Dividers" isOpen={searchQuery || subsExpanded.walls} onClick={() => toggleSub("walls")} />
                          {(searchQuery || subsExpanded.walls) && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {filteredWalls.map(preset => (
                                <button
                                  key={preset.id}
                                  onClick={() => addFixturePreset(preset)}
                                  draggable={true}
                                  onDragStart={e => {
                                    e.dataTransfer.setData("application/react-preset", JSON.stringify({ preset, presetType: "fixture" }));
                                    e.dataTransfer.effectAllowed = "copy";
                                  }}
                                  style={presetButtonStyle}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.background = C.goldFaintest; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.background = "transparent"; }}
                                >
                                  <div style={{ width: 14, height: 4, background: "#8A8278", borderRadius: 1, flexShrink: 0 }} />
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: C.textPrimary, fontFamily: F }}>{preset.label}</div>
                                    <div style={{ fontSize: 8, color: C.textTertiary, fontFamily: F }}>{preset.width} × {preset.height} cm</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {filteredDoors.length > 0 && (
                        <div style={{ marginTop: filteredWalls.length > 0 ? 6 : 0 }}>
                          <SubSectionHeader title="Doors &amp; Openings" isOpen={searchQuery || subsExpanded.doors} onClick={() => toggleSub("doors")} />
                          {(searchQuery || subsExpanded.doors) && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {filteredDoors.map(preset => (
                                <button
                                  key={preset.id}
                                  onClick={() => addFixturePreset(preset)}
                                  draggable={true}
                                  onDragStart={e => {
                                    e.dataTransfer.setData("application/react-preset", JSON.stringify({ preset, presetType: "fixture" }));
                                    e.dataTransfer.effectAllowed = "copy";
                                  }}
                                  style={presetButtonStyle}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.background = C.goldFaintest; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.background = "transparent"; }}
                                >
                                  <div style={{ width: 14, height: 10, borderLeft: `2px solid ${C.gold}`, borderBottom: "1px dashed rgba(0,0,0,0.2)", flexShrink: 0 }} />
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: C.textPrimary, fontFamily: F }}>{preset.label}</div>
                                    <div style={{ fontSize: 8, color: C.textTertiary, fontFamily: F }}>{preset.width} × {preset.height} cm</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* C. Fixtures */}
              {(filteredDisplays.length > 0 || filteredAirflow.length > 0 || filteredFixtures.length > 0) && (
                <div>
                  <CategoryHeader
                    title="Fixtures"
                    isOpen={isFixturesOpen}
                    onClick={() => setFixturesExpanded(!fixturesExpanded)}
                    count={filteredDisplays.length + filteredAirflow.length + filteredFixtures.length}
                  />
                  {isFixturesOpen && (
                    <div style={{ padding: "6px 12px 12px", display: "flex", flexDirection: "column", gap: 8, borderBottom: `1px solid ${C.divider}` }}>
                      {filteredDisplays.length > 0 && (
                        <div>
                          <SubSectionHeader title="Displays &amp; TVs" isOpen={searchQuery || subsExpanded.displays} onClick={() => toggleSub("displays")} />
                          {(searchQuery || subsExpanded.displays) && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {filteredDisplays.map(preset => (
                                <button
                                  key={preset.id}
                                  onClick={() => addFixturePreset(preset)}
                                  draggable={true}
                                  onDragStart={e => {
                                    e.dataTransfer.setData("application/react-preset", JSON.stringify({ preset, presetType: "fixture" }));
                                    e.dataTransfer.effectAllowed = "copy";
                                  }}
                                  style={presetButtonStyle}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.background = C.goldFaintest; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.background = "transparent"; }}
                                >
                                  <div style={{ width: 14, height: 10, background: "#18140E", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 1, flexShrink: 0 }} />
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: C.textPrimary, fontFamily: F }}>{preset.label}</div>
                                    <div style={{ fontSize: 8, color: C.textTertiary, fontFamily: F }}>{preset.width} × {preset.height} cm</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {filteredAirflow.length > 0 && (
                        <div style={{ marginTop: filteredDisplays.length > 0 ? 6 : 0 }}>
                          <SubSectionHeader title="Airflow &amp; Cooling" isOpen={searchQuery || subsExpanded.airflow} onClick={() => toggleSub("airflow")} />
                          {(searchQuery || subsExpanded.airflow) && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {filteredAirflow.map(preset => (
                                <button
                                  key={preset.id}
                                  onClick={() => addFixturePreset(preset)}
                                  draggable={true}
                                  onDragStart={e => {
                                    e.dataTransfer.setData("application/react-preset", JSON.stringify({ preset, presetType: "fixture" }));
                                    e.dataTransfer.effectAllowed = "copy";
                                  }}
                                  style={presetButtonStyle}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.background = C.goldFaintest; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.background = "transparent"; }}
                                >
                                  <div style={{ width: 12, height: 12, borderRadius: preset.fixture_type.includes("fan") ? "50%" : 2, border: `1.5px solid ${C.textSecondary}`, background: "#FAF8F4", flexShrink: 0 }} />
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: C.textPrimary, fontFamily: F }}>{preset.label}</div>
                                    <div style={{ fontSize: 8, color: C.textTertiary, fontFamily: F }}>{preset.width} × {preset.height} cm</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}

                      {filteredFixtures.length > 0 && (
                        <div style={{ marginTop: (filteredDisplays.length > 0 || filteredAirflow.length > 0) ? 6 : 0 }}>
                          <SubSectionHeader title="General Fixtures" isOpen={searchQuery || subsExpanded.fixtures} onClick={() => toggleSub("fixtures")} />
                          {(searchQuery || subsExpanded.fixtures) && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 180, overflowY: "auto" }} className="sm-scroll">
                              {filteredFixtures.map(preset => (
                                <button
                                  key={preset.id}
                                  onClick={() => addFixturePreset(preset)}
                                  draggable={true}
                                  onDragStart={e => {
                                    e.dataTransfer.setData("application/react-preset", JSON.stringify({ preset, presetType: "fixture" }));
                                    e.dataTransfer.effectAllowed = "copy";
                                  }}
                                  style={presetButtonStyle}
                                  onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.background = C.goldFaintest; }}
                                  onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.background = "transparent"; }}
                                >
                                  <div style={{ width: 12, height: 12, border: `1.5px dashed ${C.textSecondary}`, background: "rgba(0,0,0,0.03)", flexShrink: 0 }} />
                                  <div>
                                    <div style={{ fontSize: 10, fontWeight: 600, color: C.textPrimary, fontFamily: F }}>{preset.label}</div>
                                    <div style={{ fontSize: 8, color: C.textTertiary, fontFamily: F }}>{preset.width} × {preset.height} cm</div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* D. Annotations */}
              {filteredLabels.length > 0 && (
                <div>
                  <CategoryHeader
                    title="Annotations"
                    isOpen={isAnnotationsOpen}
                    onClick={() => setAnnotationsExpanded(!annotationsExpanded)}
                    count={filteredLabels.length}
                  />
                  {isAnnotationsOpen && (
                    <div style={{ padding: "6px 12px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div>
                        <SubSectionHeader title="Labels &amp; Markers" isOpen={searchQuery || subsExpanded.labels} onClick={() => toggleSub("labels")} />
                        {(searchQuery || subsExpanded.labels) && (
                          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                            {filteredLabels.map(preset => (
                              <button
                                key={preset.id}
                                onClick={() => addLabelPreset(preset)}
                                draggable={true}
                                onDragStart={e => {
                                  e.dataTransfer.setData("application/react-preset", JSON.stringify({ preset, presetType: "label" }));
                                  e.dataTransfer.effectAllowed = "copy";
                                }}
                                style={presetButtonStyle}
                                onMouseEnter={e => { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.background = C.goldFaintest; }}
                                onMouseLeave={e => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.background = "transparent"; }}
                              >
                                <div style={{ fontSize: 11, fontWeight: "bold", color: C.gold, fontFamily: F }}>A</div>
                                <div>
                                  <div style={{ fontSize: 10, fontWeight: 600, color: C.textPrimary, fontFamily: F }}>{preset.label}</div>
                                  <div style={{ fontSize: 8, color: C.textTertiary, fontFamily: F }}>Adds movable {preset.label.toLowerCase()}</div>
                                </div>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* No search matches state */}
              {searchQuery && !hasAnyMatches && (
                <div style={{ padding: "20px 14px", textAlign: "center", color: C.textSecondary, fontSize: 10, fontFamily: F }}>
                  No objects match "{searchQuery}"
                </div>
              )}

            </div>
          </div>
        )}

      </div>
    </div>
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
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
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
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
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
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /></svg>
            Manage Venue
          </button>
        </div>
      )}
    </div>
  );
}

// ─── INSPECTOR PANEL ──────────────────────────────────────────────────────────
function InspectorPanel({
  selected, selectedTable, selectedSeatObj, selectedStandaloneSeatObj,
  selectedLabelObj, selectedFixtureObj,
  tables, setTables, labels, setLabels, fixtures, setFixtures, standaloneSeats,
  addSeat, deleteSeat, deleteTable, deleteStandaloneSeat, deleteFixture,
  updateTable, updateLabel, updateFixture, handleSeatLabelEdit, handleSeatStatus,
  handleStandaloneSeatStatus, onRequestDelete,
  duplicateTable, duplicateStandaloneSeat, duplicateFixture,
  snapToGrid, setSnapToGrid, gridSize, setGridSize, roomWidth, setRoomWidth,
  roomHeight, setRoomHeight, undo, redo, canUndo, canRedo, exportLayout,
  importLayout, resetLayout, handleSeatCountChange, pushHistory,
  showGrid, setShowGrid,
  gridVisibility, setGridVisibility,
  smartGuidesEnabled, setSmartGuidesEnabled,
  showRulers, setShowRulers,
  canvasBgColor, setCanvasBgColor,
  canvasBgOpacity, setCanvasBgOpacity,
  canvasBgVisible, setCanvasBgVisible,
  discardChanges
}) {
  const svRef = useRef(null);
  const hueRef = useRef(null);
  const alphaRef = useRef(null);
  const colorRowRef = useRef(null);
  const popoverRef = useRef(null);

  const [isDraggingSV, setIsDraggingSV] = useState(false);
  const [isDraggingHue, setIsDraggingHue] = useState(false);
  const [isDraggingAlpha, setIsDraggingAlpha] = useState(false);
  const [showColorPickerPopover, setShowColorPickerPopover] = useState(false);
  const [popoverCoords, setPopoverCoords] = useState({ top: 300 });

  const [h, setH] = useState(0);
  const [s, setS] = useState(0);
  const [v, setV] = useState(100);
  const prevColorRef = useRef(canvasBgColor);
  const prevOpacityRef = useRef(canvasBgOpacity);
  const prevVisibleRef = useRef(canvasBgVisible);

  const handleColorFocus = () => {
    prevColorRef.current = canvasBgColor;
    prevOpacityRef.current = canvasBgOpacity;
    prevVisibleRef.current = canvasBgVisible;
  };

  // Helper to convert HSV to Hex
  const hsvToHex = (h, s, v) => {
    s /= 100;
    v /= 100;
    const k = (n) => (n + h / 60) % 6;
    const f = (n) => v * (1 - s * Math.max(0, Math.min(k(n), 4 - k(n), 1)));
    const r = Math.round(255 * f(5)).toString(16).padStart(2, "0");
    const g = Math.round(255 * f(3)).toString(16).padStart(2, "0");
    const b = Math.round(255 * f(1)).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  };

  // Helper to convert Hex to HSV
  const hexToHsv = (hex) => {
    if (!hex) return { h: 0, s: 0, v: 100 };
    hex = hex.replace(/^#/, "");
    if (hex.length === 3) {
      hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
    }
    if (hex.length !== 6) return { h: 0, s: 0, v: 100 };
    let r = parseInt(hex.substring(0, 2), 16) / 255;
    let g = parseInt(hex.substring(2, 4), 16) / 255;
    let b = parseInt(hex.substring(4, 6), 16) / 255;
    let max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h, s, v = max;
    let d = max - min;
    s = max === 0 ? 0 : d / max;
    if (max === min) {
      h = 0;
    } else {
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return {
      h: Math.round(h * 360),
      s: Math.round(s * 100),
      v: Math.round(v * 100)
    };
  };

  // Sync canvas background hex to SV/Hue states
  useEffect(() => {
    if (canvasBgColor.startsWith("#")) {
      const hsv = hexToHsv(canvasBgColor);
      setH(hsv.h);
      setS(hsv.s);
      setV(hsv.v);
    }
  }, [canvasBgColor]);

  const handleSVInteractionWithY = useCallback((clientX, clientY, rect) => {
    const w = rect.width;
    const hBox = rect.height;
    const x = Math.max(0, Math.min(w, clientX - rect.left));
    const y = Math.max(0, Math.min(hBox, clientY - rect.top));

    const newS = Math.round((x / w) * 100);
    const newV = Math.round((1 - y / hBox) * 100);

    setS(newS);
    setV(newV);
    const newHex = hsvToHex(h, newS, newV);
    setCanvasBgColor(newHex);
  }, [h, setCanvasBgColor]);

  const handleHueInteraction = useCallback((clientX, rect) => {
    const w = rect.width;
    const x = Math.max(0, Math.min(w, clientX - rect.left));
    const newH = Math.round((x / w) * 360);

    setH(newH);
    const newHex = hsvToHex(newH, s, v);
    setCanvasBgColor(newHex);
  }, [s, v, setCanvasBgColor]);

  const handleSVMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingSV(true);
    pushHistory(tables, standaloneSeats, labels, fixtures, canvasBgColor, canvasBgOpacity, canvasBgVisible);
    const rect = e.currentTarget.getBoundingClientRect();
    handleSVInteractionWithY(e.clientX, e.clientY, rect);
  };

  const handleHueMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingHue(true);
    pushHistory(tables, standaloneSeats, labels, fixtures, canvasBgColor, canvasBgOpacity, canvasBgVisible);
    const rect = e.currentTarget.getBoundingClientRect();
    handleHueInteraction(e.clientX, rect);
  };

  const handleAlphaInteraction = useCallback((clientX, rect) => {
    const w = rect.width;
    const x = Math.max(0, Math.min(w, clientX - rect.left));
    const newOpacity = Math.round((x / w) * 100);
    setCanvasBgOpacity(newOpacity);
  }, [setCanvasBgOpacity]);

  const handleAlphaMouseDown = (e) => {
    e.preventDefault();
    setIsDraggingAlpha(true);
    pushHistory(tables, standaloneSeats, labels, fixtures, canvasBgColor, canvasBgOpacity, canvasBgVisible);
    const rect = e.currentTarget.getBoundingClientRect();
    handleAlphaInteraction(e.clientX, rect);
  };

  useEffect(() => {
    if (!isDraggingSV) return;
    const handleMouseMove = (e) => {
      if (svRef.current) {
        const rect = svRef.current.getBoundingClientRect();
        handleSVInteractionWithY(e.clientX, e.clientY, rect);
      }
    };
    const handleMouseUp = () => {
      setIsDraggingSV(false);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingSV, handleSVInteractionWithY]);

  useEffect(() => {
    if (!isDraggingHue) return;
    const handleMouseMove = (e) => {
      if (hueRef.current) {
        const rect = hueRef.current.getBoundingClientRect();
        handleHueInteraction(e.clientX, rect);
      }
    };
    const handleMouseUp = () => {
      setIsDraggingHue(false);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingHue, handleHueInteraction]);

  useEffect(() => {
    if (!isDraggingAlpha) return;
    const handleMouseMove = (e) => {
      if (alphaRef.current) {
        const rect = alphaRef.current.getBoundingClientRect();
        handleAlphaInteraction(e.clientX, rect);
      }
    };
    const handleMouseUp = () => {
      setIsDraggingAlpha(false);
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingAlpha, handleAlphaInteraction]);

  // Click outside to dismiss color popover
  useEffect(() => {
    if (!showColorPickerPopover) return;
    const handleOutsideClick = (e) => {
      if (colorRowRef.current && colorRowRef.current.contains(e.target)) return;
      if (popoverRef.current && popoverRef.current.contains(e.target)) return;
      setShowColorPickerPopover(false);
    };
    window.addEventListener("mousedown", handleOutsideClick);
    return () => window.removeEventListener("mousedown", handleOutsideClick);
  }, [showColorPickerPopover]);

  const toggleVisibility = () => {
    pushHistory(tables, standaloneSeats, labels, fixtures, canvasBgColor, canvasBgOpacity, canvasBgVisible);
    setCanvasBgVisible(prev => !prev);
  };

  const togglePopover = () => {
    if (!showColorPickerPopover) {
      if (colorRowRef.current) {
        const rect = colorRowRef.current.getBoundingClientRect();
        setPopoverCoords({
          top: Math.max(80, Math.min(window.innerHeight - 280, rect.top - 100))
        });
      }
    }
    setShowColorPickerPopover(prev => !prev);
  };
  const iLabel = t => (
    <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", color: C.gold, textTransform: "uppercase", marginBottom: 5, marginTop: 12, fontFamily: F }}>{t}</div>
  );

  const iInput = props => (
    <input
      style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, fontFamily: F, fontSize: 11, color: C.textPrimary, background: C.surfaceInput, boxSizing: "border-box", outline: "none", transition: "border-color 0.15s, box-shadow 0.15s" }}
      onFocus={e => { e.target.style.borderColor = C.borderAccent; e.target.style.boxShadow = C.inputFocus; }}
      onBlur={e => { e.target.style.borderColor = C.borderDefault; e.target.style.boxShadow = "none"; }}
      {...props}
    />
  );

  const DeleteBtn = ({ label, deleteKey }) => (
    <button
      onClick={() => onRequestDelete(deleteKey)}
      style={{ width: "100%", marginTop: 12, padding: "8px 0", background: "transparent", color: C.red, border: `1px solid ${C.redBorder}`, borderRadius: 6, fontFamily: F, fontWeight: 600, fontSize: 10, cursor: "pointer", transition: "background 0.14s", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}
      onMouseEnter={e => e.currentTarget.style.background = C.redFaint}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <Trash2 size={11} />
      {label}
    </button>
  );

  const AddSeatBtn = ({ tableId }) => (
    <button
      onClick={() => addSeat(tableId)}
      style={{ flex: 1, padding: "6px 0", background: "transparent", color: C.green, border: `1px solid ${C.greenBorder}`, borderRadius: 5, fontFamily: F, fontWeight: 600, fontSize: 10, cursor: "pointer", transition: "background 0.14s", display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}
      onMouseEnter={e => e.currentTarget.style.background = C.greenFaint}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      <Plus size={10} />
      Add Seat
    </button>
  );

  const RemoveLastBtn = () => (
    <button
      onClick={deleteSeat}
      style={{ flex: 1, padding: "6px 0", background: "transparent", color: C.red, border: `1px solid ${C.redBorder}`, borderRadius: 5, fontFamily: F, fontWeight: 600, fontSize: 10, cursor: "pointer", transition: "background 0.14s" }}
      onMouseEnter={e => e.currentTarget.style.background = C.redFaint}
      onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
      − Remove Last
    </button>
  );

  const changeTablePreset = async (presetId, customTableId) => {
    const tid = customTableId || selected?.tableId;
    if (!tid) return;
    const table = tables.find(t => t.id === tid);
    if (!table) return;

    const preset = TABLE_PRESETS.find(p => p.id === presetId);
    if (!preset) return;

    const newSeatCount = preset.defaultSeatCount;
    const currentSeatsCount = table.seats?.length || 0;

    // Safety check first: warn if removing seats that have active bookings
    if (newSeatCount < currentSeatsCount) {
      const truncated = table.seats.slice(newSeatCount);
      const hasBookings = truncated.some(s => s.status !== "available");
      if (hasBookings) {
        const confirm = window.confirm("Warning: Changing table type will reduce seats. Some of the seats being removed have active or pending reservations. Are you sure you want to proceed? This will remove their bookings.");
        if (!confirm) return;
      }
      for (const seat of truncated) {
        try { await cleanupReservationsForDeletedSeat(seat, table, activeWing, activeRoom, "admin"); } catch { }
      }
    }

    pushHistory();
    setTables(p => p.map(t => {
      if (t.id !== tid) return t;

      let updatedSeats = [...(t.seats || [])];
      if (newSeatCount < currentSeatsCount) {
        updatedSeats = updatedSeats.slice(0, newSeatCount);
      } else if (newSeatCount > currentSeatsCount) {
        for (let i = currentSeatsCount; i < newSeatCount; i++) {
          const num = i + 1;
          updatedSeats.push({
            id: `${t.id}-S${num}-${Date.now()}`,
            num,
            label: `S${num}`,
            status: "available"
          });
        }
      }

      return {
        ...t,
        shape: preset.shape === "rectangle" ? "rect" : preset.shape,
        width: preset.width,
        height: preset.height,
        seats: updatedSeats,
        editor: {
          ...(t.editor || {}),
          preset_id: preset.id,
          chair_style: preset.defaultChairStyle || "standard-dining",
          seat_spacing_cm: preset.defaultSeatSpacing || 8,
          min_capacity: preset.minSeatCount ?? 0,
          max_capacity: preset.maxSeatCount ?? newSeatCount,
        }
      };
    }));
  };

  const changeFixturePreset = (presetId) => {
    const preset = FIXTURE_PRESETS.find(p => p.id === presetId);
    if (!preset || !selectedFixtureObj) return;
    pushHistory();
    setFixtures(p => p.map(f => {
      if (f.id !== selectedFixtureObj.id) return f;
      return {
        ...f,
        fixture_type: preset.fixture_type,
        label: preset.label,
        width: preset.width,
        height: preset.height
      };
    }));
  };

  return (
    <div style={{ fontFamily: F }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: "0.20em", color: C.gold, textTransform: "uppercase", marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Studio Inspector</span>
        <div style={{ display: "flex", gap: 6 }}>
          <button disabled={!canUndo} onClick={undo} style={{ background: "transparent", border: "none", cursor: canUndo ? "pointer" : "not-allowed", color: canUndo ? C.textPrimary : C.textTertiary, opacity: canUndo ? 1 : 0.4, padding: 2 }} title="Undo (Ctrl+Z)">
            <Undo2 size={12} />
          </button>
          <button disabled={!canRedo} onClick={redo} style={{ background: "transparent", border: "none", cursor: canRedo ? "pointer" : "not-allowed", color: canRedo ? C.textPrimary : C.textTertiary, opacity: canRedo ? 1 : 0.4, padding: 2 }} title="Redo (Ctrl+Y)">
            <Redo2 size={12} />
          </button>
        </div>
      </div>

      {/* ── Nothing selected: Canvas settings ── */}
      {!selected && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSecondary, marginBottom: 6 }}>Room Dimensions (cm)</div>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Width</span>
                {iInput({ type: "number", value: roomWidth, onChange: e => setRoomWidth(Number(e.target.value)) })}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Height</span>
                {iInput({ type: "number", value: roomHeight, onChange: e => setRoomHeight(Number(e.target.value)) })}
              </div>
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textSecondary }}>Show Grid</span>
              <input type="checkbox" checked={showGrid !== false} onChange={e => setShowGrid(e.target.checked)} style={{ accentColor: C.gold }} />
            </div>
            {showGrid !== false && (
              <div style={{ marginBottom: 6 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <span style={{ fontSize: 8, color: C.textTertiary }}>Grid Visibility (%)</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={gridVisibility ?? 30}
                    onChange={e => setGridVisibility(Math.min(100, Math.max(0, Number(e.target.value))))}
                    style={{ width: "42px", background: "transparent", border: `1px solid ${C.borderDefault}`, borderRadius: 4, textAlign: "center", fontSize: 10, fontFamily: "monospace" }}
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={gridVisibility ?? 30}
                  onChange={e => setGridVisibility(Number(e.target.value))}
                  style={{ width: "100%", accentColor: C.gold, cursor: "pointer" }}
                />
              </div>
            )}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textSecondary }}>Snap to Grid</span>
              <input type="checkbox" checked={snapToGrid} onChange={e => setSnapToGrid(e.target.checked)} style={{ accentColor: C.gold }} />
            </div>
            {snapToGrid && (
              <div>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Grid Size (cm)</span>
                <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <select value={gridSize} onChange={e => setGridSize(Number(e.target.value))} style={{ flex: 1, padding: "7px 10px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, fontFamily: F, fontSize: 11, background: C.surfaceInput, color: C.textPrimary, outline: "none" }}>
                    <option value={10}>10 cm</option>
                    <option value={20}>20 cm</option>
                    <option value={25}>25 cm (Bellevue standard)</option>
                    <option value={50}>50 cm</option>
                  </select>
                  <input
                    type="number"
                    min="5"
                    max="100"
                    value={gridSize}
                    onChange={e => setGridSize(Math.max(5, Math.min(100, Number(e.target.value))))}
                    style={{ width: "45px", padding: "6px 4px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, textAlign: "center", fontSize: 11, outline: "none" }}
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textSecondary }}>Smart Guides</span>
              <input type="checkbox" checked={smartGuidesEnabled !== false} onChange={e => setSmartGuidesEnabled(e.target.checked)} style={{ accentColor: C.gold }} />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textSecondary }}>Show Rulers</span>
              <input type="checkbox" checked={showRulers !== false} onChange={e => setShowRulers(e.target.checked)} style={{ accentColor: C.gold }} />
            </div>
          </div>

          <div id="canvas-bg-inspector" style={{ transition: "outline 0.2s ease", borderRadius: 8, padding: "2px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.textSecondary, marginBottom: 8, fontFamily: F }}>Page</div>

            {/* Figma-Style properties row */}
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div
                ref={colorRowRef}
                onClick={togglePopover}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: C.surfaceInput,
                  border: `1px solid ${C.borderDefault}`,
                  borderRadius: 6,
                  padding: "4px 8px",
                  cursor: "pointer",
                  flex: 1,
                  userSelect: "none"
                }}
              >
                {/* Color preview tile with checkerboard */}
                <div
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: 4,
                    position: "relative",
                    border: `1.5px solid ${C.borderDefault}`,
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                    backgroundImage: "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
                    backgroundSize: "8px 8px",
                    backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0",
                    flexShrink: 0
                  }}
                >
                  <div style={{
                    position: "absolute",
                    inset: 0,
                    borderRadius: 3,
                    background: canvasBgVisible ? hexToRgba(canvasBgColor, canvasBgOpacity) : "transparent"
                  }} />
                </div>

                {/* Hex Display */}
                <div
                  style={{
                    flex: 1,
                    fontSize: 11,
                    fontFamily: "monospace",
                    color: C.textPrimary,
                    fontWeight: 600,
                    textTransform: "uppercase"
                  }}
                >
                  {canvasBgColor.replace(/^#/, "")}
                </div>

                {/* Separator | */}
                <div style={{ width: 1, height: 16, background: C.borderDefault }} />

                {/* Opacity Value */}
                <div
                  style={{
                    fontSize: 11,
                    color: C.textSecondary,
                    textAlign: "right",
                    fontWeight: 600,
                    whiteSpace: "nowrap",
                    paddingRight: 2
                  }}
                >
                  {canvasBgOpacity} %
                </div>
              </div>

              {/* Eye visibility toggle (outside the pill) */}
              <button
                onClick={toggleVisibility}
                style={{
                  background: "transparent",
                  border: "none",
                  color: canvasBgVisible ? C.textPrimary : C.textTertiary,
                  cursor: "pointer",
                  display: "flex",
                  padding: 4,
                  alignItems: "center",
                  opacity: canvasBgVisible ? 1 : 0.6,
                  transition: "opacity 0.15s ease"
                }}
                title={canvasBgVisible ? "Hide Canvas Background" : "Show Canvas Background"}
              >
                {canvasBgVisible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
            </div>

            {/* Floating popover/modal positioned next to the sidebar */}
            {showColorPickerPopover && (
              <div
                ref={popoverRef}
                style={{
                  position: "fixed",
                  zIndex: 99999,
                  right: 260, // Float to the left of the 252px sidebar
                  top: popoverCoords.top,
                  width: 220,
                  background: C.surfaceRaised,
                  border: `1px solid ${C.borderDefault}`,
                  borderRadius: 12,
                  boxShadow: "0 10px 32px rgba(0,0,0,0.18)",
                  padding: 12,
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                  boxSizing: "border-box"
                }}
              >
                {/* Popover Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.divider}`, paddingBottom: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 700, color: C.textPrimary }}>Custom Color</span>
                  <button
                    onClick={() => setShowColorPickerPopover(false)}
                    style={{ background: "transparent", border: "none", color: C.textSecondary, cursor: "pointer", display: "flex", padding: 2 }}
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Figma-Style SV Box */}
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div
                    ref={svRef}
                    onMouseDown={handleSVMouseDown}
                    style={{
                      width: "100%",
                      height: 120,
                      borderRadius: 6,
                      position: "relative",
                      backgroundColor: `hsl(${h}, 100%, 50%)`,
                      backgroundImage: "linear-gradient(to top, #000000, transparent), linear-gradient(to right, #ffffff, transparent)",
                      cursor: "crosshair",
                      boxShadow: "inset 0 1px 4px rgba(0,0,0,0.2), 0 2px 8px rgba(0,0,0,0.1)",
                      border: `1px solid ${C.borderDefault}`,
                      overflow: "hidden"
                    }}
                  >
                    {/* SV pointer */}
                    <div
                      style={{
                        position: "absolute",
                        left: `${s}%`,
                        top: `${100 - v}%`,
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        border: "2px solid #ffffff",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.5)",
                        transform: "translate(-6px, -6px)",
                        pointerEvents: "none",
                        background: canvasBgColor.startsWith("#") ? canvasBgColor : "#fff"
                      }}
                    />
                  </div>
                </div>

                {/* Figma-Style Hue Slider */}
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ fontSize: 8, color: C.textTertiary }}>Hue</div>
                  <div
                    ref={hueRef}
                    onMouseDown={handleHueMouseDown}
                    style={{
                      width: "100%",
                      height: 12,
                      borderRadius: 6,
                      position: "relative",
                      background: "linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)",
                      cursor: "ew-resize",
                      boxShadow: "inset 0 1px 3px rgba(0,0,0,0.15)",
                      border: `1px solid ${C.borderDefault}`
                    }}
                  >
                    {/* Hue pointer */}
                    <div
                      style={{
                        position: "absolute",
                        left: `${(h / 360) * 100}%`,
                        top: "50%",
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        border: "2px solid #ffffff",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                        transform: "translate(-6px, -50%)",
                        pointerEvents: "none",
                        background: `hsl(${h}, 100%, 50%)`
                      }}
                    />
                  </div>
                </div>

                {/* Opacity/Alpha Slider */}
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <div style={{ fontSize: 8, color: C.textTertiary }}>Opacity</div>
                  <div
                    ref={alphaRef}
                    onMouseDown={handleAlphaMouseDown}
                    style={{
                      width: "100%",
                      height: 12,
                      borderRadius: 6,
                      position: "relative",
                      cursor: "ew-resize",
                      boxShadow: "inset 0 1px 3px rgba(0,0,0,0.15)",
                      border: `1px solid ${C.borderDefault}`,
                      overflow: "hidden",
                      backgroundImage: "linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)",
                      backgroundSize: "8px 8px",
                      backgroundPosition: "0 0, 0 4px, 4px -4px, -4px 0"
                    }}
                  >
                    <div style={{
                      position: "absolute",
                      inset: 0,
                      background: `linear-gradient(to right, transparent, ${hsvToHex(h, s, v)})`
                    }} />
                    {/* Alpha slider pointer */}
                    <div
                      style={{
                        position: "absolute",
                        left: `${canvasBgOpacity}%`,
                        top: "50%",
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        border: "2px solid #ffffff",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
                        transform: "translate(-6px, -50%)",
                        pointerEvents: "none",
                        background: "#fff"
                      }}
                    />
                  </div>
                </div>

                {/* Input Fields Row */}
                <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 4 }}>
                  {/* Hex Dropdown Pill */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 10,
                    fontWeight: 600,
                    color: C.textPrimary,
                    background: C.surfaceInput,
                    border: `1px solid ${C.borderDefault}`,
                    borderRadius: 4,
                    padding: "4px 6px",
                    userSelect: "none",
                    cursor: "pointer"
                  }}>
                    Hex
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                  </div>

                  <input
                    type="text"
                    value={canvasBgColor.replace(/^#/, "").toUpperCase()}
                    onFocus={handleColorFocus}
                    onMouseDown={handleColorFocus}
                    onChange={e => {
                      let val = e.target.value.replace(/[^0-9A-Fa-f]/g, "");
                      if (val.length > 6) val = val.substring(0, 6);
                      setCanvasBgColor("#" + val);
                    }}
                    onBlur={e => {
                      let val = e.target.value.replace(/[^0-9A-Fa-f]/g, "");
                      if (val.length === 3) {
                        val = val[0] + val[0] + val[1] + val[1] + val[2] + val[2];
                      }
                      while (val.length < 6) val += "F";
                      const finalHex = "#" + val.toUpperCase();
                      setCanvasBgColor(finalHex);
                      if (finalHex !== prevColorRef.current) {
                        pushHistory(tables, standaloneSeats, labels, fixtures, prevColorRef.current, canvasBgOpacity, canvasBgVisible);
                      }
                    }}
                    style={{
                      flex: 1,
                      fontSize: 10,
                      padding: "4px 6px",
                      background: C.surfaceInput,
                      color: C.textPrimary,
                      border: `1px solid ${C.borderDefault}`,
                      borderRadius: 4,
                      fontFamily: "monospace",
                      textAlign: "center",
                      outline: "none"
                    }}
                  />

                  {/* Opacity Value Input */}
                  <div style={{ display: "flex", alignItems: "center", background: C.surfaceInput, border: `1px solid ${C.borderDefault}`, borderRadius: 4, padding: "2px 4px", width: 48 }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={canvasBgOpacity}
                      onFocus={handleColorFocus}
                      onMouseDown={handleColorFocus}
                      onChange={e => {
                        const val = Math.max(0, Math.min(100, Number(e.target.value)));
                        setCanvasBgOpacity(val);
                      }}
                      onBlur={() => {
                        if (canvasBgOpacity !== prevOpacityRef.current) {
                          pushHistory(tables, standaloneSeats, labels, fixtures, canvasBgColor, prevOpacityRef.current, canvasBgVisible);
                        }
                      }}
                      style={{
                        width: "100%",
                        fontSize: 10,
                        background: "transparent",
                        border: "none",
                        color: C.textPrimary,
                        textAlign: "right",
                        padding: 0,
                        outline: "none"
                      }}
                    />
                    <span style={{ fontSize: 9, color: C.textTertiary, marginLeft: 2 }}>%</span>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Import / Export Section */}
          <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 12, marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSecondary, marginBottom: 8, letterSpacing: "0.05em" }}>Import / Export</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button
                onClick={exportLayout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "8px 4px",
                  background: "transparent",
                  border: `1px solid ${C.borderAccent}`,
                  borderRadius: 6,
                  fontFamily: F,
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: C.gold,
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = C.goldFaint}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <Download size={10} />
                Export JSON
              </button>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "8px 4px",
                  background: "transparent",
                  border: `1px solid ${C.borderDefault}`,
                  borderRadius: 6,
                  fontFamily: F,
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: C.textSecondary,
                  cursor: "pointer",
                  textAlign: "center",
                  transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.borderAccent}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.borderDefault}
              >
                <Upload size={10} />
                Import JSON
                <input type="file" accept=".json" onChange={importLayout} style={{ display: "none" }} />
              </label>
            </div>
          </div>

          {/* Draft & Reset Operations Section */}
          <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 12, marginTop: 8 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.textSecondary, marginBottom: 8, letterSpacing: "0.05em" }}>Draft & Reset Options</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
              <button
                onClick={discardChanges}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "8px 4px",
                  background: "transparent",
                  border: `1px solid ${C.borderDefault}`,
                  borderRadius: 6,
                  fontFamily: F,
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: C.textSecondary,
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = C.gold}
                onMouseLeave={e => e.currentTarget.style.borderColor = C.borderDefault}
              >
                <RotateCcw size={10} />
                Discard Draft
              </button>
              <button
                onClick={resetLayout}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 4,
                  padding: "8px 4px",
                  background: "transparent",
                  border: `1px solid ${C.redBorder}`,
                  borderRadius: 6,
                  fontFamily: F,
                  fontWeight: 700,
                  fontSize: 9,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: C.red,
                  cursor: "pointer",
                  transition: "all 0.15s"
                }}
                onMouseEnter={e => e.currentTarget.style.background = C.redFaint}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}
              >
                <Trash2 size={10} />
                Reset Room
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Table selected ── */}
      {selected?.type === "table" && selectedTable && (() => {
        const presetId = selectedTable.editor?.preset_id || "custom-table";
        const preset = TABLE_PRESETS.find(p => p.id === presetId) || TABLE_PRESETS.find(p => p.id === "custom-table");
        const minChairs = preset?.minSeatCount ?? 0;
        const maxChairs = preset?.maxSeatCount ?? 8;
        const seatCount = selectedTable.seats?.length || 0;

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              {iLabel("Table Preset")}
              <select value={presetId} onChange={e => changeTablePreset(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, fontFamily: F, fontSize: 12, background: C.surfaceInput, color: C.textPrimary, outline: "none" }}>
                {TABLE_PRESETS.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              {iLabel("Table Label")}
              {iInput({ value: selectedTable.label || selectedTable.id, onChange: e => updateTable("label", e.target.value) })}
            </div>

            <div>
              {iLabel("Shape")}
              <select value={selectedTable.shape || "rect"} onChange={e => updateTable("shape", e.target.value)} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, fontFamily: F, fontSize: 12, background: C.surfaceInput, color: C.textPrimary, outline: "none" }}>
                <option value="rect">Rectangle</option>
                <option value="square">Square</option>
                <option value="round">Round Banquet</option>
                <option value="oval">Oval Classic</option>
                <option value="banquet">Long Banquet</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Width (cm)</span>
                {iInput({ type: "number", value: Math.round(selectedTable.width || 110), onChange: e => updateTable("width", Number(e.target.value)) })}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Height (cm)</span>
                {iInput({ type: "number", value: Math.round(selectedTable.height || 70), onChange: e => updateTable("height", Number(e.target.value)) })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Position X</span>
                {iInput({ type: "number", value: Math.round(selectedTable.x || 0), onChange: e => updateTable("x", Number(e.target.value)) })}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Position Y</span>
                {iInput({ type: "number", value: Math.round(selectedTable.y || 0), onChange: e => updateTable("y", Number(e.target.value)) })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 4 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Rotation (°)</span>
                {iInput({ type: "number", min: 0, max: 360, value: selectedTable.editor?.rotation || 0, onChange: e => updateTable("editor", { ...(selectedTable.editor || {}), rotation: Number(e.target.value) }) })}
              </div>
              <button onClick={() => updateTable("editor", { ...(selectedTable.editor || {}), locked: !selectedTable.editor?.locked })} style={{ marginTop: 14, flex: 1, padding: "8px 0", background: selectedTable.editor?.locked ? `${C.gold}15` : "transparent", border: `1px solid ${selectedTable.editor?.locked ? C.gold : C.borderDefault}`, color: selectedTable.editor?.locked ? C.gold : C.textSecondary, borderRadius: 6, fontFamily: F, fontWeight: 700, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                {selectedTable.editor?.locked ? <Lock size={11} /> : <Unlock size={11} />}
                {selectedTable.editor?.locked ? "Locked" : "Lock Pos."}
              </button>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Min Capacity</span>
                {iInput({ type: "number", value: selectedTable.editor?.min_capacity ?? 0, onChange: e => updateTable("editor", { ...(selectedTable.editor || {}), min_capacity: Number(e.target.value) }) })}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Max Capacity</span>
                {iInput({ type: "number", value: selectedTable.editor?.max_capacity ?? seatCount, onChange: e => updateTable("editor", { ...(selectedTable.editor || {}), max_capacity: Number(e.target.value) }) })}
              </div>
            </div>

            <div>
              <span style={{ fontSize: 8, color: C.textTertiary }}>Notes / Internal Label</span>
              <textarea
                value={selectedTable.editor?.notes || ""}
                onChange={e => updateTable("editor", { ...(selectedTable.editor || {}), notes: e.target.value })}
                placeholder="Internal notes or category tags..."
                style={{
                  width: "100%",
                  height: "50px",
                  padding: "8px 10px",
                  border: `1px solid ${C.borderDefault}`,
                  borderRadius: 6,
                  fontFamily: F,
                  fontSize: 11,
                  color: C.textPrimary,
                  background: C.surfaceInput,
                  boxSizing: "border-box",
                  outline: "none",
                  resize: "none",
                  transition: "border-color 0.15s, box-shadow 0.15s"
                }}
                onFocus={e => { e.target.style.borderColor = C.borderAccent; e.target.style.boxShadow = C.inputFocus; }}
                onBlur={e => { e.target.style.borderColor = C.borderDefault; e.target.style.boxShadow = "none"; }}
              />
            </div>

            <div>
              {iLabel("Chair Configuration")}
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input type="range" min={minChairs} max={maxChairs} value={seatCount} onChange={e => handleSeatCountChange(selectedTable.id, Number(e.target.value))} style={{ flex: 1, accentColor: C.gold }} />
                <input type="number" min={minChairs} max={maxChairs} value={seatCount} onChange={e => handleSeatCountChange(selectedTable.id, Math.min(maxChairs, Math.max(minChairs, Number(e.target.value))))} style={{ width: 44, padding: "4px", border: `1px solid ${C.borderDefault}`, borderRadius: 4, textAlign: "center", fontFamily: F, fontSize: 11 }} />
              </div>

              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Chair Spacing (cm)</span>
                <input type="range" min="4" max="16" value={selectedTable.editor?.seat_spacing_cm || 8} onChange={e => updateTable("editor", { ...(selectedTable.editor || {}), seat_spacing_cm: Number(e.target.value) })} style={{ width: "100%", accentColor: C.gold }} />
              </div>

              <div style={{ marginTop: 8 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Chair Visual Style</span>
                <select value={selectedTable.editor?.chair_style || "standard-dining"} onChange={e => updateTable("editor", { ...(selectedTable.editor || {}), chair_style: e.target.value })} style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, fontFamily: F, fontSize: 11, background: C.surfaceInput, color: C.textPrimary, outline: "none" }}>
                  {CHAIR_STYLES.map(c => (
                    <option key={c.id} value={c.id}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={() => duplicateTable(selectedTable)} style={{ flex: 1, padding: "8px 0", background: "transparent", color: C.gold, border: `1px solid ${C.borderAccent}`, borderRadius: 6, fontFamily: F, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                onMouseEnter={e => e.currentTarget.style.background = C.goldFaint}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <Copy size={11} />
                Duplicate Table
              </button>
            </div>
            <DeleteBtn label="Delete Table" deleteKey="table" />
          </div>
        );
      })()}

      {/* ── Individual seat selected ── */}
      {selected?.type === "seat" && selectedSeatObj && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            {iLabel("Seat Label")}
            {iInput({
              value: selectedSeatObj.label || selectedSeatObj.num,
              onChange: e => handleSeatLabelEdit(e.target.value),
            })}
          </div>

          <div>
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
          </div>

          <div>
            {iLabel("Parent Table")}
            <div style={{ fontSize: 11, fontWeight: 600, color: C.textSecondary, fontFamily: F }}>{tables.find(t => t.id === selected.tableId)?.label}</div>
          </div>

          <div>
            {iLabel("Chair Style Override")}
            <select value={selectedSeatObj.editor?.chair_style_override || ""} onChange={e => {
              pushHistory();
              setTables(p => p.map(t => t.id !== selected.tableId ? t : {
                ...t,
                seats: t.seats.map(s => s.id === selected.seatId ? { ...s, editor: { ...(s.editor || {}), chair_style_override: e.target.value || null } } : s)
              }));
            }} style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, fontFamily: F, fontSize: 11, background: C.surfaceInput, color: C.textPrimary, outline: "none" }}>
              <option value="">Use parent table style</option>
              {CHAIR_STYLES.map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            {iLabel("Reservation Status (Read-Only)")}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: `${STATUS_COLORS[selectedSeatObj.status || "available"]}15`, border: `1.5px solid ${STATUS_COLORS[selectedSeatObj.status || "available"]}`, width: "100%" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[selectedSeatObj.status || "available"] }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: STATUS_COLORS[selectedSeatObj.status || "available"], textTransform: "uppercase" }}>
                {STATUS_LABELS[selectedSeatObj.status || "available"]}
              </span>
            </div>
          </div>

          <DeleteBtn label="Delete This Seat" deleteKey="seat" />
        </div>
      )}

      {/* ── Standalone seat selected ── */}
      {selected?.type === "standaloneSeat" && selectedStandaloneSeatObj && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            {iLabel("Seat Label")}
            {iInput({
              value: selectedStandaloneSeatObj.label || "",
              onChange: e => setStandaloneSeats(p => p.map(s => s.id === selected.standaloneSeatId ? { ...s, label: e.target.value } : s))
            })}
          </div>

          <div>
            {iLabel("Seat Number")}
            {iInput({
              type: "number",
              value: selectedStandaloneSeatObj.num,
              onChange: e => setStandaloneSeats(p => p.map(s => s.id === selected.standaloneSeatId ? { ...s, num: Number(e.target.value) } : s))
            })}
          </div>

          <div>
            {iLabel("Chair Style")}
            <select value={selectedStandaloneSeatObj.editor?.chair_style || "standard-standalone"} onChange={e => {
              pushHistory();
              setStandaloneSeats(p => p.map(s => s.id === selected.standaloneSeatId ? {
                ...s,
                editor: { ...(s.editor || {}), chair_style: e.target.value }
              } : s));
            }} style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, fontFamily: F, fontSize: 11, background: C.surfaceInput, color: C.textPrimary, outline: "none" }}>
              {STANDALONE_CHAIR_PRESETS.map(c => (
                <option key={c.id} value={c.chair_style}>{c.label}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 8, color: C.textTertiary }}>Width (cm)</span>
              {iInput({ type: "number", value: Math.round(selectedStandaloneSeatObj.editor?.width || 38), onChange: e => setStandaloneSeats(p => p.map(s => s.id === selected.standaloneSeatId ? { ...s, editor: { ...(s.editor || {}), width: Number(e.target.value) } } : s)) })}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 8, color: C.textTertiary }}>Height (cm)</span>
              {iInput({ type: "number", value: Math.round(selectedStandaloneSeatObj.editor?.height || 38), onChange: e => setStandaloneSeats(p => p.map(s => s.id === selected.standaloneSeatId ? { ...s, editor: { ...(s.editor || {}), height: Number(e.target.value) } } : s)) })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 8, color: C.textTertiary }}>Position X</span>
              {iInput({ type: "number", value: Math.round(selectedStandaloneSeatObj.x || 0), onChange: e => setStandaloneSeats(p => p.map(s => s.id === selected.standaloneSeatId ? { ...s, x: Number(e.target.value) } : s)) })}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 8, color: C.textTertiary }}>Position Y</span>
              {iInput({ type: "number", value: Math.round(selectedStandaloneSeatObj.y || 0), onChange: e => setStandaloneSeats(p => p.map(s => s.id === selected.standaloneSeatId ? { ...s, y: Number(e.target.value) } : s)) })}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 8, color: C.textTertiary }}>Rotation (°)</span>
              {iInput({ type: "number", min: 0, max: 360, value: selectedStandaloneSeatObj.editor?.rotation || 0, onChange: e => setStandaloneSeats(p => p.map(s => s.id === selected.standaloneSeatId ? { ...s, editor: { ...(s.editor || {}), rotation: Number(e.target.value) } } : s)) })}
            </div>
            <button onClick={() => setStandaloneSeats(p => p.map(s => s.id === selected.standaloneSeatId ? { ...s, editor: { ...(s.editor || {}), locked: !s.editor?.locked } } : s))} style={{ marginTop: 14, flex: 1, padding: "8px 0", background: selectedStandaloneSeatObj.editor?.locked ? `${C.gold}15` : "transparent", border: `1px solid ${selectedStandaloneSeatObj.editor?.locked ? C.gold : C.borderDefault}`, color: selectedStandaloneSeatObj.editor?.locked ? C.gold : C.textSecondary, borderRadius: 6, fontFamily: F, fontWeight: 700, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
              {selectedStandaloneSeatObj.editor?.locked ? <Lock size={11} /> : <Unlock size={11} />}
              {selectedStandaloneSeatObj.editor?.locked ? "Locked" : "Lock Position"}
            </button>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: C.textSecondary }}>Reservable Seating</span>
              <input type="checkbox" checked={selectedStandaloneSeatObj.editor?.reservable !== false} onChange={e => {
                pushHistory();
                setStandaloneSeats(p => p.map(s => s.id === selected.standaloneSeatId ? { ...s, editor: { ...(s.editor || {}), reservable: e.target.checked } } : s));
              }} style={{ accentColor: C.gold }} />
            </div>
          </div>

          <div>
            {iLabel("Reservation Status (Read-Only)")}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: 8, background: `${STATUS_COLORS[selectedStandaloneSeatObj.status || "available"]}15`, border: `1.5px solid ${STATUS_COLORS[selectedStandaloneSeatObj.status || "available"]}`, width: "100%" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: STATUS_COLORS[selectedStandaloneSeatObj.status || "available"] }} />
              <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: STATUS_COLORS[selectedStandaloneSeatObj.status || "available"], textTransform: "uppercase" }}>
                {STATUS_LABELS[selectedStandaloneSeatObj.status || "available"]}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button onClick={() => duplicateStandaloneSeat(selectedStandaloneSeatObj)} style={{ flex: 1, padding: "8px 0", background: "transparent", color: C.gold, border: `1px solid ${C.borderAccent}`, borderRadius: 6, fontFamily: F, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
              onMouseEnter={e => e.currentTarget.style.background = C.goldFaint}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
              <Copy size={11} />
              Duplicate Seat
            </button>
          </div>
          <DeleteBtn label="Delete Seat" deleteKey="standaloneSeat" />
        </div>
      )}

      {/* ── Fixture selected ── */}
      {selected?.type === "fixture" && selectedFixtureObj && (() => {
        const ALL_FIXTURES_LIST = [
          ...FIXTURE_PRESETS,
          ...DISPLAY_PRESETS,
          ...AIRFLOW_PRESETS,
          ...ENTRANCE_PRESETS,
          ...WALL_PRESETS
        ];
        const selectedPreset = ALL_FIXTURES_LIST.find(p => p.fixture_type === selectedFixtureObj.fixture_type) || ALL_FIXTURES_LIST.find(p => p.fixture_type === "custom-object") || ALL_FIXTURES_LIST[0];

        return (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              {iLabel("Fixture Library Template")}
              <select value={selectedPreset.id} onChange={e => changeFixturePreset(e.target.value)} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, fontFamily: F, fontSize: 12, background: C.surfaceInput, color: C.textPrimary, outline: "none" }}>
                {ALL_FIXTURES_LIST.map(p => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </select>
            </div>

            <div>
              {iLabel("Fixture Label")}
              {iInput({
                value: selectedFixtureObj.label || "",
                onChange: e => updateFixture("label", e.target.value)
              })}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Width (cm)</span>
                {iInput({ type: "number", value: Math.round(selectedFixtureObj.width || 80), onChange: e => updateFixture("width", Number(e.target.value)) })}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Height (cm)</span>
                {iInput({ type: "number", value: Math.round(selectedFixtureObj.height || 60), onChange: e => updateFixture("height", Number(e.target.value)) })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Position X</span>
                {iInput({ type: "number", value: Math.round(selectedFixtureObj.x || 0), onChange: e => updateFixture("x", Number(e.target.value)) })}
              </div>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Position Y</span>
                {iInput({ type: "number", value: Math.round(selectedFixtureObj.y || 0), onChange: e => updateFixture("y", Number(e.target.value)) })}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div style={{ flex: 1 }}>
                <span style={{ fontSize: 8, color: C.textTertiary }}>Rotation (°)</span>
                {iInput({ type: "number", min: 0, max: 360, value: selectedFixtureObj.editor?.rotation || 0, onChange: e => updateFixture("editor", { ...(selectedFixtureObj.editor || {}), rotation: Number(e.target.value) }) })}
              </div>
              <button onClick={() => updateFixture("editor", { ...(selectedFixtureObj.editor || {}), locked: !selectedFixtureObj.editor?.locked })} style={{ marginTop: 14, flex: 1, padding: "8px 0", background: selectedFixtureObj.editor?.locked ? `${C.gold}15` : "transparent", border: `1px solid ${selectedFixtureObj.editor?.locked ? C.gold : C.borderDefault}`, color: selectedFixtureObj.editor?.locked ? C.gold : C.textSecondary, borderRadius: 6, fontFamily: F, fontWeight: 700, fontSize: 10, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                {selectedFixtureObj.editor?.locked ? <Lock size={11} /> : <Unlock size={11} />}
                {selectedFixtureObj.editor?.locked ? "Locked" : "Lock Position"}
              </button>
            </div>

            {/* Wall Specific thickness and curved wall bend radius controls */}
            {["straight-wall", "curved-wall", "partition-wall", "glass-divider", "movable-divider", "half-wall", "room-boundary-segment"].includes(selectedFixtureObj.fixture_type) && (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <span style={{ fontSize: 8, color: C.textTertiary }}>Wall Thickness: {selectedFixtureObj.editor?.thickness || 8} cm</span>
                  <input type="range" min="2" max="40" value={selectedFixtureObj.editor?.thickness || 8} onChange={e => updateFixture("editor", { thickness: Number(e.target.value) })} style={{ width: "100%", accentColor: C.gold, cursor: "pointer" }} />
                </div>

                {selectedFixtureObj.fixture_type === "curved-wall" && (
                  <div>
                    <span style={{ fontSize: 8, color: C.textTertiary }}>Curvature Strength: {selectedFixtureObj.editor?.curve_strength || 50} cm</span>
                    <input type="range" min="-150" max="150" value={selectedFixtureObj.editor?.curve_strength || 50} onChange={e => updateFixture("editor", { curve_strength: Number(e.target.value) })} style={{ width: "100%", accentColor: C.gold, cursor: "pointer" }} />
                  </div>
                )}
              </div>
            )}

            {/* Displays Specific mounting style selectors */}
            {["projection-screen", "small-tv", "medium-tv", "large-tv", "extra-large-tv", "led-wall"].includes(selectedFixtureObj.fixture_type) && (
              <div>
                {iLabel("Mounting Style")}
                <select value={selectedFixtureObj.editor?.mounting_style || "wall-mounted"} onChange={e => updateFixture("editor", { mounting_style: e.target.value })} style={{ width: "100%", padding: "7px 10px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, fontFamily: F, fontSize: 11, background: C.surfaceInput, color: C.textPrimary, outline: "none" }}>
                  <option value="wall-mounted">Wall Mounted</option>
                  <option value="stand-mounted">Stand Mounted</option>
                  <option value="ceiling-mounted">Ceiling Mounted</option>
                </select>
              </div>
            )}

            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button onClick={() => duplicateFixture(selectedFixtureObj)} style={{ flex: 1, padding: "8px 0", background: "transparent", color: C.gold, border: `1px solid ${C.borderAccent}`, borderRadius: 6, fontFamily: F, fontWeight: 700, fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}
                onMouseEnter={e => e.currentTarget.style.background = C.goldFaint}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                <Copy size={11} />
                Duplicate Object
              </button>
            </div>
            <DeleteBtn label="Delete Fixture" deleteKey="fixture" />
          </div>
        );
      })()}

      {/* ── Label selected ── */}
      {selected?.type === "label" && selectedLabelObj && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, overflowY: "auto", flex: 1 }}>
          <div>
            {iLabel("Label Text")}
            {iInput({
              value: selectedLabelObj.label || "",
              onChange: e => updateLabel("label", e.target.value)
            })}
          </div>

          <div>
            {iLabel("Marker Type")}
            <select value={selectedLabelObj.type || "other"} onChange={e => updateLabel("type", e.target.value)} style={{ width: "100%", padding: "8px 10px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, fontFamily: F, fontSize: 12, background: C.surfaceInput, color: C.textPrimary, outline: "none" }}>
              <option value="screen">Screen Block</option>
              <option value="other">Area / Boundary Label</option>
            </select>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 8, color: C.textTertiary }}>Position X</span>
              {iInput({ type: "number", value: Math.round(selectedLabelObj.x || 0), onChange: e => updateLabel("x", Number(e.target.value)) })}
            </div>
            <div style={{ flex: 1 }}>
              <span style={{ fontSize: 8, color: C.textTertiary }}>Position Y</span>
              {iInput({ type: "number", value: Math.round(selectedLabelObj.y || 0), onChange: e => updateLabel("y", Number(e.target.value)) })}
            </div>
          </div>

          <DeleteBtn label="Delete Label" deleteKey="label" />
        </div>
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
  const adminTheme = useAdminTheme();
  const normalize = useCallback(td => {
    if (!td) return [];
    if (Array.isArray(td)) return td.map(t => ({ shape: "rect", width: 110, height: 70, ...t }));
    return [{ shape: "rect", width: 110, height: 70, ...td }];
  }, []);

  const [tables, setTables] = useState(() => editMode ? [] : normalize(tableData));
  const [labels, setLabels] = useState(() => {
    if (!editMode && tableData && tableData.labels) return tableData.labels;
    return DEFAULT_LABELS;
  });
  const [standaloneSeats, setStandaloneSeats] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [selected, setSelected] = useState(null);
  const [selectedStandaloneSeats, setSelectedStandaloneSeats] = useState(new Set());
  const [viewportSize, setViewportSize] = useState({ width: 800, height: 600 });
  const [saved, setSaved] = useState(false);
  const [isDraft, setIsDraft] = useState(false);
  const [layoutVersion, setLayoutVersion] = useState(1);
  const [tool, setTool] = useState("select");
  const [activeDragId, setActiveDragId] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [showVenueManager, setShowVenueManager] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [publishError, setPublishError] = useState("");

  // ── Panning & Zooming & Blueprint Guides ────────────────────────────────────
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.7);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [gridSize, setGridSize] = useState(25);
  const [roomWidth, setRoomWidth] = useState(1200);
  const [roomHeight, setRoomHeight] = useState(800);
  const [canvasBgColor, setCanvasBgColor] = useState(() => {
    if (!editMode && tableData?.editor?.canvas_bg_color) return tableData.editor.canvas_bg_color;
    return "#FAF9F5";
  });
  const [canvasBgOpacity, setCanvasBgOpacity] = useState(() => {
    if (!editMode && tableData?.editor?.canvas_bg_opacity !== undefined) return tableData.editor.canvas_bg_opacity;
    return 100;
  });
  const [canvasBgVisible, setCanvasBgVisible] = useState(() => {
    if (!editMode && tableData?.editor?.canvas_bg_visible !== undefined) return tableData.editor.canvas_bg_visible;
    return true;
  });
  const [alignGuides, setAlignGuides] = useState(null);
  const [isPanning, setIsPanning] = useState(false);
  const [spacePressed, setSpacePressed] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [gridVisibility, setGridVisibility] = useState(30);
  const [smartGuidesEnabled, setSmartGuidesEnabled] = useState(true);
  const [showRulers, setShowRulers] = useState(true);

  // ── History States for Undo / Redo ──────────────────────────────────────────
  const [history, setHistory] = useState({ past: [], future: [] });

  const pushHistory = useCallback((currentTables = tables, currentSeats = standaloneSeats, currentLabels = labels, currentFixtures = fixtures, currentCanvasBgColor = canvasBgColor, currentCanvasBgOpacity = canvasBgOpacity, currentCanvasBgVisible = canvasBgVisible) => {
    userEditedRef.current = true;  // Mark that user has made a real edit
    setHistory(prev => ({
      past: [...prev.past, {
        tables: JSON.parse(JSON.stringify(currentTables)),
        standaloneSeats: JSON.parse(JSON.stringify(currentSeats)),
        labels: JSON.parse(JSON.stringify(currentLabels)),
        fixtures: JSON.parse(JSON.stringify(currentFixtures)),
        canvasBgColor: currentCanvasBgColor,
        canvasBgOpacity: currentCanvasBgOpacity,
        canvasBgVisible: currentCanvasBgVisible
      }].slice(-50),
      future: []
    }));
  }, [tables, standaloneSeats, labels, fixtures, canvasBgColor, canvasBgOpacity, canvasBgVisible]);

  const undo = useCallback(() => {
    setHistory(prev => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      const newPast = prev.past.slice(0, -1);
      const newFuture = [{
        tables: JSON.parse(JSON.stringify(tables)),
        standaloneSeats: JSON.parse(JSON.stringify(standaloneSeats)),
        labels: JSON.parse(JSON.stringify(labels)),
        fixtures: JSON.parse(JSON.stringify(fixtures)),
        canvasBgColor: canvasBgColor,
        canvasBgOpacity: canvasBgOpacity,
        canvasBgVisible: canvasBgVisible
      }, ...prev.future];

      setTables(previous.tables);
      setStandaloneSeats(previous.standaloneSeats);
      setLabels(previous.labels);
      setFixtures(previous.fixtures || []);
      if (previous.canvasBgColor) setCanvasBgColor(previous.canvasBgColor);
      if (previous.canvasBgOpacity !== undefined) setCanvasBgOpacity(previous.canvasBgOpacity);
      if (previous.canvasBgVisible !== undefined) setCanvasBgVisible(previous.canvasBgVisible);
      setSelected(null);
      return { past: newPast, future: newFuture };
    });
  }, [tables, standaloneSeats, labels, fixtures, canvasBgColor, canvasBgOpacity, canvasBgVisible]);

  const redo = useCallback(() => {
    setHistory(prev => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      const newFuture = prev.future.slice(1);
      const newPast = [...prev.past, {
        tables: JSON.parse(JSON.stringify(tables)),
        standaloneSeats: JSON.parse(JSON.stringify(standaloneSeats)),
        labels: JSON.parse(JSON.stringify(labels)),
        fixtures: JSON.parse(JSON.stringify(fixtures)),
        canvasBgColor: canvasBgColor,
        canvasBgOpacity: canvasBgOpacity,
        canvasBgVisible: canvasBgVisible
      }];

      setTables(next.tables);
      setStandaloneSeats(next.standaloneSeats);
      setLabels(next.labels);
      setFixtures(next.fixtures || []);
      if (next.canvasBgColor) setCanvasBgColor(next.canvasBgColor);
      if (next.canvasBgOpacity !== undefined) setCanvasBgOpacity(next.canvasBgOpacity);
      if (next.canvasBgVisible !== undefined) setCanvasBgVisible(next.canvasBgVisible);
      setSelected(null);
      return { past: newPast, future: newFuture };
    });
  }, [tables, standaloneSeats, labels, fixtures, canvasBgColor, canvasBgOpacity, canvasBgVisible]);

  const [venueStructure, setVenueStructure] = useState(() => loadVenueStructure());
  const [venuesList, setVenuesList] = useState([]);
  const currentAdmin = useMemo(() => authAPI.getCurrentUser(), []);
  const visibleVenueStructure = useMemo(
    () => getScopedOutletGroups(currentAdmin, venueStructure),
    [currentAdmin, venueStructure]
  );
  const canManageVenues = authAPI.hasPermission("manage_venues");

  const [activeWing, setActiveWing] = useState(wing || "Main Wing");
  const [activeRoom, setActiveRoom] = useState(room || "Alabang Function Room");

  const loadedRef = useRef(false);
  const userEditedRef = useRef(false);  // Only true after a real user edit, prevents auto-save race
  const autoSaveTimerRef = useRef(null);
  const dragging = useRef(null);
  const canvasRef = useRef(null);
  const canvasViewportRef = useRef(null);
  const panStart = useRef({ x: 0, y: 0 });
  const adminScaleRef = useRef(1);
  const pendingCenterRef = useRef(false);
  const viewportClickStartRef = useRef({ x: 0, y: 0 });
  const touchStartDist = useRef(null);
  const touchStartZoom = useRef(null);
  const T = getClientTokens(isDark);

  useEffect(() => {
    const handler = e => {
      if (e.detail?.structure) setVenueStructure(e.detail.structure);
    };
    window.addEventListener("venue:structure:changed", handler);
    return () => window.removeEventListener("venue:structure:changed", handler);
  }, []);

  useEffect(() => {
    if (!canvasViewportRef.current) return;
    const updateSize = () => {
      if (canvasViewportRef.current) {
        setViewportSize({
          width: canvasViewportRef.current.clientWidth,
          height: canvasViewportRef.current.clientHeight
        });
      }
    };
    updateSize();
    window.addEventListener("resize", updateSize);
    let observer;
    if (window.ResizeObserver && canvasViewportRef.current) {
      observer = new ResizeObserver(updateSize);
      observer.observe(canvasViewportRef.current);
    }
    return () => {
      window.removeEventListener("resize", updateSize);
      if (observer) observer.disconnect();
    };
  }, [canvasViewportRef.current]);

  const centerMap = useCallback(() => {
    if (viewportSize.width > 50 && viewportSize.height > 50) {
      const padding = 28;
      const fitZoomW = (viewportSize.width - padding * 2) / roomWidth;
      const fitZoomH = (viewportSize.height - padding * 2) / roomHeight;
      const zoomLevel = Math.min(fitZoomW, fitZoomH, 1.2);
      const finalZoom = Math.max(0.15, zoomLevel);
      const px = Math.round((viewportSize.width - roomWidth * finalZoom) / 2);
      const py = Math.round((viewportSize.height - roomHeight * finalZoom) / 2);
      setZoom(finalZoom);
      setPan({ x: px, y: py });
    }
  }, [viewportSize, roomWidth, roomHeight]);

  const handleViewportMouseDown = (e) => {
    console.log('[SeatMap] handleViewportMouseDown button:', e.button, 'editMode:', editMode);
    viewportClickStartRef.current = { x: e.clientX, y: e.clientY };
    const isMiddleClick = e.button === 1;
    const isSpaceDrag = spacePressed || tool === "pan";
    const isClientLeftClickDrag = !editMode && e.button === 0;
    console.log('[SeatMap] panning checks - middle:', isMiddleClick, 'space:', isSpaceDrag, 'clientLeft:', isClientLeftClickDrag);
    if (isMiddleClick || isSpaceDrag || isClientLeftClickDrag) {
      e.preventDefault();
      setIsPanning(true);
      panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
      console.log('[SeatMap] Panning activated! panStart:', panStart.current);
    }
  };

  const handleViewportTouchStart = (e) => {
    if (e.touches.length === 1) {
      setIsPanning(true);
      const touch = e.touches[0];
      panStart.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
      touchStartDist.current = null;
    } else if (e.touches.length === 2) {
      setIsPanning(true);
      const t1 = e.touches[0];
      const t2 = e.touches[1];
      const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
      touchStartDist.current = dist;
      touchStartZoom.current = zoom;
    }
  };

  // Centering hook that triggers once viewport size is measured and valid
  useEffect(() => {
    if (!pendingCenterRef.current) return;
    if (viewportSize.width > 50 && viewportSize.height > 50) {
      centerMap();
      pendingCenterRef.current = false;
    }
  }, [viewportSize, activeRoom, activeWing, tableData, roomWidth, roomHeight, centerMap]);

  useEffect(() => {
    let mounted = true;
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";
    const loadDynamicStructure = async () => {
      try {
        const token = localStorage.getItem("admin_token");
        const headers = { Accept: "application/json" };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${API_BASE_URL}/venues?include_archived=false&_t=${Date.now()}`, { headers });
        if (!res.ok) return;
        const venues = await res.json();
        if (!mounted || !Array.isArray(venues)) return;

        setVenuesList(venues);
        const activeVenues = venues.filter(v => !v.is_archived);
        const parentIdsWithChildren = activeVenues.filter(v => v.parent_id !== null).map(v => v.parent_id);

        const selectableRooms = activeVenues.filter(v => {
          if (v.parent_id !== null) return true;
          return !parentIdsWithChildren.includes(v.id);
        });

        const staticWings = {
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

        const groups = {};
        selectableRooms.forEach(v => {
          let wingLabel = staticWings[v.name];
          if (!wingLabel) {
            const isDining = String(v.type || "").toLowerCase() === "dining"
              || String(v.wing || "").toLowerCase() === "dining"
              || String(v.name || "").toLowerCase().includes("restaurant")
              || String(v.name || "").toLowerCase().includes("qsina")
              || String(v.name || "").toLowerCase().includes("hanakazu")
              || String(v.name || "").toLowerCase().includes("phoenix");

            wingLabel = isDining ? "Dining" : (v.wing || "Main Wing");
          }

          const wingId = String(wingLabel).toLowerCase().replace(/[^a-z0-9]+/g, "-");

          if (!groups[wingId]) {
            groups[wingId] = {
              id: wingId,
              label: wingLabel,
              rooms: []
            };
          }

          groups[wingId].rooms.push(v.name);
        });

        const order = { "main-wing": 0, "grand-ballroom": 1, "tower-wing": 2, "dining": 3 };
        const sortedStructure = Object.values(groups).sort((a, b) => {
          const oA = order[a.id] ?? 99;
          const oB = order[b.id] ?? 99;
          if (oA !== oB) return oA - oB;
          return a.label.localeCompare(b.label);
        });

        if (sortedStructure.length > 0) {
          setVenueStructure(sortedStructure);
          localStorage.setItem("bellevue_venue_structure", JSON.stringify(sortedStructure));
          window.dispatchEvent(new CustomEvent("venue:structure:changed", { detail: { structure: sortedStructure } }));
        }
      } catch (err) {
        console.error("[SeatMap] Failed to load venues for structure:", err);
      }
    };
    loadDynamicStructure();
    return () => { mounted = false; };
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
    if (!activeWing || !activeRoom) return;

    // Reset all flags BEFORE starting async fetch
    loadedRef.current = false;
    userEditedRef.current = false;
    if (autoSaveTimerRef.current) { clearTimeout(autoSaveTimerRef.current); autoSaveTimerRef.current = null; }
    _tableCounter = 1;
    _standaloneCounter = 1;

    const matchedVenue = venuesList.find(v => v.name === activeRoom);
    const venueId = matchedVenue ? matchedVenue.id : null;

    if (!venueId) {
      // Venue list not loaded yet — don't show empty canvas, just wait
      return;
    }

    fetchAdminSeatmap(venueId).then(res => {
      if (res && res.data) {
        setIsDraft(res.is_draft || false);
        setLayoutVersion(res.version || 1);
        const stored = res.data;
        const norm = normalize(stored.tables || []).filter(t => t.seats?.length > 0);
        setTables(norm);
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
        const fixs = (stored.fixtures || []).map(f => ({ ...f, type: "fixture" }));
        setFixtures(fixs);
        fixs.forEach(f => {
          const n = parseInt(f.id?.replace(/\D/g, "")) || 0;
          if (n >= _fixtureCounter) _fixtureCounter = n + 1;
        });

        // Load Editor Configurations
        let loadedWidth = 1200;
        let loadedHeight = 800;
        if (stored.editor) {
          if (stored.editor.room_width_cm) {
            loadedWidth = stored.editor.room_width_cm;
            setRoomWidth(loadedWidth);
          }
          if (stored.editor.room_height_cm) {
            loadedHeight = stored.editor.room_height_cm;
            setRoomHeight(loadedHeight);
          }
          if (stored.editor.grid_cm) setGridSize(stored.editor.grid_cm);
          if (stored.editor.snap_enabled !== undefined) setSnapToGrid(stored.editor.snap_enabled);
          if (stored.editor.show_grid !== undefined) setShowGrid(stored.editor.show_grid);
          if (stored.editor.grid_visibility !== undefined) setGridVisibility(stored.editor.grid_visibility);
          if (stored.editor.smart_guides_enabled !== undefined) setSmartGuidesEnabled(stored.editor.smart_guides_enabled);
          if (stored.editor.show_rulers !== undefined) setShowRulers(stored.editor.show_rulers);
          if (stored.editor.canvas_bg_color) setCanvasBgColor(stored.editor.canvas_bg_color);
          setCanvasBgOpacity(stored.editor.canvas_bg_opacity !== undefined ? stored.editor.canvas_bg_opacity : 100);
          setCanvasBgVisible(stored.editor.canvas_bg_visible !== undefined ? stored.editor.canvas_bg_visible : true);
        } else {
          setRoomWidth(loadedWidth); setRoomHeight(loadedHeight); setGridSize(25); setSnapToGrid(true);
          setShowGrid(true); setGridVisibility(30);
          setSmartGuidesEnabled(true); setShowRulers(true);
          setCanvasBgColor("#FAF9F5");
          setCanvasBgOpacity(100);
          setCanvasBgVisible(true);
        }

        // Mark centering as pending
        pendingCenterRef.current = true;
      } else {
        setIsDraft(false); setLayoutVersion(1);
        setTables([]); setLabels(DEFAULT_LABELS); setStandaloneSeats([]); setFixtures([]);
        setRoomWidth(1200); setRoomHeight(800); setGridSize(25); setSnapToGrid(true);
        setShowGrid(true); setGridVisibility(30); setSmartGuidesEnabled(true); setShowRulers(true);
        setCanvasBgColor("#FAF9F5");
        setCanvasBgOpacity(100);
        setCanvasBgVisible(true);

        // Mark centering as pending
        pendingCenterRef.current = true;
      }
      setHistory({ past: [], future: [] });
      setSelected(null);
      // Mark as loaded AFTER state is set — userEditedRef stays false until a real user action
      setTimeout(() => { loadedRef.current = true; }, 100);
    });
  }, [editMode, activeWing, activeRoom, venuesList, normalize]);

  // ── AUTO-SAVE DRAFT (debounced, only after real user edits) ──────────────────
  useEffect(() => {
    if (!editMode || !activeWing || !activeRoom) return;
    if (!loadedRef.current) return;   // Not loaded yet — skip
    if (!userEditedRef.current) return; // No real user edit — skip (prevents race condition)

    // Debounce: clear previous timer
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);

    autoSaveTimerRef.current = setTimeout(() => {
      const completeData = {
        tables, labels, standaloneSeats, fixtures,
        editor: {
          room_width_cm: roomWidth, room_height_cm: roomHeight, grid_cm: gridSize,
          snap_enabled: snapToGrid, zoom, pan, show_grid: showGrid, grid_visibility: gridVisibility,
          smart_guides_enabled: smartGuidesEnabled, show_rulers: showRulers,
          canvas_bg_color: canvasBgColor,
          canvas_bg_opacity: canvasBgOpacity,
          canvas_bg_visible: canvasBgVisible
        }
      };
      const matchedVenue = venuesList.find(v => v.name === activeRoom);
      const venueId = matchedVenue ? matchedVenue.id : null;
      if (venueId) {
        saveDraftSeatmap(venueId, completeData).then(success => {
          if (success) setIsDraft(true);
        });
      }
    }, 600);

    return () => { if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current); };
  }, [tables, labels, standaloneSeats, fixtures, editMode, activeWing, activeRoom, roomWidth, roomHeight, gridSize, snapToGrid, zoom, pan, showGrid, gridVisibility, smartGuidesEnabled, showRulers, canvasBgColor, canvasBgOpacity, canvasBgVisible]);

  // ── Client: sync from prop ───────────────────────────────────────────────────
  useEffect(() => {
    if (editMode) return;
    if (!tableData) return;
    let loadedWidth = 1200;
    let loadedHeight = 800;
    if (tableData.v === 2) {
      setTables(normalize(tableData.tables || []).filter(t => t.seats?.length > 0));
      setLabels(tableData.labels?.length ? tableData.labels : DEFAULT_LABELS);
      setStandaloneSeats(tableData.standaloneSeats || []);
      setFixtures(tableData.fixtures || []);
      if (tableData.editor) {
        if (tableData.editor.room_width_cm) {
          loadedWidth = tableData.editor.room_width_cm;
          setRoomWidth(loadedWidth);
        }
        if (tableData.editor.room_height_cm) {
          loadedHeight = tableData.editor.room_height_cm;
          setRoomHeight(loadedHeight);
        }
        if (tableData.editor.canvas_bg_color) setCanvasBgColor(tableData.editor.canvas_bg_color);
        setCanvasBgOpacity(tableData.editor.canvas_bg_opacity !== undefined ? tableData.editor.canvas_bg_opacity : 100);
        setCanvasBgVisible(tableData.editor.canvas_bg_visible !== undefined ? tableData.editor.canvas_bg_visible : true);
      }
    } else if (tableData.tables) {
      setTables(normalize(tableData.tables).filter(t => t.seats?.length > 0));
      setLabels(tableData.labels?.length ? tableData.labels : DEFAULT_LABELS);
      setStandaloneSeats(tableData.standaloneSeats || []);
      setFixtures(tableData.fixtures || []);
      if (tableData.editor) {
        if (tableData.editor.room_width_cm) {
          loadedWidth = tableData.editor.room_width_cm;
          setRoomWidth(loadedWidth);
        }
        if (tableData.editor.room_height_cm) {
          loadedHeight = tableData.editor.room_height_cm;
          setRoomHeight(loadedHeight);
        }
        if (tableData.editor.canvas_bg_color) setCanvasBgColor(tableData.editor.canvas_bg_color);
        setCanvasBgOpacity(tableData.editor.canvas_bg_opacity !== undefined ? tableData.editor.canvas_bg_opacity : 100);
        setCanvasBgVisible(tableData.editor.canvas_bg_visible !== undefined ? tableData.editor.canvas_bg_visible : true);
      }
    } else if (Array.isArray(tableData)) {
      setTables(normalize(tableData).filter(t => t.seats?.length > 0));
      setLabels(DEFAULT_LABELS); setStandaloneSeats([]);
      setCanvasBgColor("#FAF9F5");
      setCanvasBgOpacity(100);
      setCanvasBgVisible(true);
    }

    // Mark centering as pending
    pendingCenterRef.current = true;
  }, [tableData, normalize, editMode]);

  const selectedTable = selected?.type === "table" ? tables.find(t => t.id === selected.tableId) : null;
  const selectedSeatObj = selected?.type === "seat" ? tables.find(t => t.id === selected.tableId)?.seats.find(s => s.id === selected.seatId) : null;
  const selectedStandaloneSeatObj = selected?.type === "standaloneSeat" ? standaloneSeats.find(s => s.id === selected.standaloneSeatId) : null;
  const selectedLabelObj = selected?.type === "label" ? labels.find(l => l.id === selected.labelId) : null;
  const selectedFixtureObj = selected?.type === "fixture" ? fixtures.find(f => f.id === selected.fixtureId) : null;

  const quickInspectorPosition = useMemo(() => {
    if (selected?.type !== "table" || !selectedTable || !canvasViewportRef.current) {
      return null;
    }
    const { width: viewportWidth, height: viewportHeight } = viewportSize;
    const tx = selectedTable.x;
    const ty = selectedTable.y;
    const tw = selectedTable.width || 110;
    const th = selectedTable.height || 70;

    const tableLeft = tx * zoom + pan.x;
    const tableTop = ty * zoom + pan.y;
    const tableWidthScaled = tw * zoom;
    const tableHeightScaled = th * zoom;
    const tableCenterX = tableLeft + tableWidthScaled / 2;
    const tableCenterY = tableTop + tableHeightScaled / 2;

    const W = 280;
    const H = 250; // Estimated height for compact inspector
    const margin = 12;

    let left = 0;
    let top = 0;
    let placement = "right";

    // Priority 1: Right
    const rightLeft = tableLeft + tableWidthScaled + margin;
    const rightTop = tableCenterY - H / 2;
    if (rightLeft + W <= viewportWidth && rightTop >= 0 && rightTop + H <= viewportHeight) {
      left = rightLeft;
      top = rightTop;
      placement = "right";
    }
    // Priority 2: Left
    else {
      const leftLeft = tableLeft - W - margin;
      const leftTop = tableCenterY - H / 2;
      if (leftLeft >= 0 && leftTop >= 0 && leftTop + H <= viewportHeight) {
        left = leftLeft;
        top = leftTop;
        placement = "left";
      }
      // Priority 3: Bottom
      else {
        const bottomLeft = tableCenterX - W / 2;
        const bottomTop = tableTop + tableHeightScaled + margin;
        if (bottomTop + H <= viewportHeight && bottomLeft >= 0 && bottomLeft + W <= viewportWidth) {
          left = bottomLeft;
          top = bottomTop;
          placement = "bottom";
        }
        // Priority 4: Top
        else {
          const topLeft = tableCenterX - W / 2;
          const topTop = tableTop - H - margin;
          if (topTop >= 0 && topLeft >= 0 && topLeft + W <= viewportWidth) {
            left = topLeft;
            top = topTop;
            placement = "top";
          }
          // Priority 5: Fallback & Dock to visible viewport corners
          else {
            left = rightLeft;
            top = rightTop;
            placement = "docked";
          }
        }
      }
    }

    // Clamp inside viewport margins
    left = Math.max(16, Math.min(viewportWidth - W - 16, left));
    top = Math.max(16, Math.min(viewportHeight - H - 16, top));

    return { left, top, placement };
  }, [selected, selectedTable, zoom, pan, viewportSize]);

  // ── Drag & Alignment Guide handlers ───────────────────────────────────────────────
  useEffect(() => {
    if (!editMode) return;
    const THRESHOLD = 4;
    const onMove = e => {
      const d = dragging.current; if (!d) return;
      const rawDx = e.clientX - d.startX, rawDy = e.clientY - d.startY;
      if (!d.active) {
        if (Math.abs(rawDx) < THRESHOLD && Math.abs(rawDy) < THRESHOLD) return;
        d.active = true;
        setActiveDragId(d.id);
        pushHistory();
      }

      let dx = rawDx / zoom;
      let dy = rawDy / zoom;

      let newX = d.originX + dx;
      let newY = d.originY + dy;

      if (snapToGrid) {
        newX = Math.round(newX / gridSize) * gridSize;
        newY = Math.round(newY / gridSize) * gridSize;
      }

      const w = d.type === "table"
        ? (tables.find(t => t.id === d.id)?.width || 110)
        : d.type === "fixture"
          ? (fixtures.find(f => f.id === d.id)?.width || 80)
          : d.type === "label"
            ? 100
            : 38;
      const h = d.type === "table"
        ? (tables.find(t => t.id === d.id)?.height || 70)
        : d.type === "fixture"
          ? (fixtures.find(f => f.id === d.id)?.height || 60)
          : d.type === "label"
            ? 30
            : 38;
      newX = Math.max(0, Math.min(roomWidth - w, newX));
      newY = Math.max(0, Math.min(roomHeight - h, newY));

      // Alignment Guides calculations
      let alignX = null;
      let alignY = null;
      const ALIGN_THRESHOLD = 6;

      const candidates = [
        ...tables.filter(t => t.id !== d.id).map(t => ({ x: t.x, y: t.y, w: t.width || 110, h: t.height || 70 })),
        ...standaloneSeats.filter(s => s.id !== d.id).map(s => ({ x: s.x, y: s.y, w: 38, h: 38 })),
        ...fixtures.filter(f => f.id !== d.id).map(f => ({ x: f.x, y: f.y, w: f.width || 80, h: f.height || 60 }))
      ];

      for (const cand of candidates) {
        const leftAlign = Math.abs(newX - cand.x);
        const centerAlign = Math.abs((newX + w / 2) - (cand.x + cand.w / 2));
        const rightAlign = Math.abs((newX + w) - (cand.x + cand.w));

        if (leftAlign < ALIGN_THRESHOLD) { newX = cand.x; alignX = cand.x; }
        else if (centerAlign < ALIGN_THRESHOLD) { newX = cand.x + cand.w / 2 - w / 2; alignX = cand.x + cand.w / 2; }
        else if (rightAlign < ALIGN_THRESHOLD) { newX = cand.x + cand.w - w; alignX = cand.x + cand.w; }

        const topAlign = Math.abs(newY - cand.y);
        const middleAlign = Math.abs((newY + h / 2) - (cand.y + cand.h / 2));
        const bottomAlign = Math.abs((newY + h) - (cand.y + cand.h));

        if (topAlign < ALIGN_THRESHOLD) { newY = cand.y; alignY = cand.y; }
        else if (middleAlign < ALIGN_THRESHOLD) { newY = cand.y + cand.h / 2 - h / 2; alignY = cand.y + cand.h / 2; }
        else if (bottomAlign < ALIGN_THRESHOLD) { newY = cand.y + cand.h - h; alignY = cand.y + cand.h; }
      }

      setAlignGuides({ x: alignX, y: alignY });

      if (d.type === "table") setTables(p => p.map(t => t.id === d.id ? { ...t, x: newX, y: newY } : t));
      else if (d.type === "label") setLabels(p => p.map(l => l.id === d.id ? { ...l, x: newX, y: newY } : l));
      else if (d.type === "standaloneSeat") setStandaloneSeats(p => p.map(ss => ss.id === d.id ? { ...ss, x: newX, y: newY } : ss));
      else if (d.type === "fixture") setFixtures(p => p.map(f => f.id === d.id ? { ...f, x: newX, y: newY } : f));
    };
    const onUp = () => {
      dragging.current = null;
      setActiveDragId(null);
      setAlignGuides(null);
    };
    window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [editMode, tables, standaloneSeats, labels, fixtures, zoom, snapToGrid, gridSize, roomWidth, roomHeight, pushHistory]);

  // ── Keyboard Shortcuts (ESC, DEL, Undo/Redo/Duplicate) ────────────────────────
  useEffect(() => {
    const h = e => {
      if (e.key === "Escape") { setSelected(null); setTool("select"); }
      else if (e.key === "Delete" && editMode && selected) {
        if (selected.type === "table") {
          const tbl = tables.find(t => t.id === selected.tableId);
          if (tbl?.editor?.locked) return;
          setDeleteConfirm({ key: "table", message: `Delete "${tbl?.label || tbl?.id}"? This will also remove all ${tbl?.seats?.length || 0} seats and cannot be undone.` });
        } else if (selected.type === "seat") {
          const seatObj = tables.find(t => t.id === selected.tableId)?.seats.find(s => s.id === selected.seatId);
          setDeleteConfirm({ key: "seat", message: `Delete seat "${seatObj?.label || seatObj?.num}"? This cannot be undone.` });
        } else if (selected.type === "standaloneSeat") {
          const ss = standaloneSeats.find(s => s.id === selected.standaloneSeatId);
          if (ss?.editor?.locked) return;
          setDeleteConfirm({ key: "standaloneSeat", message: "Delete this standalone seat? This cannot be undone." });
        } else if (selected.type === "fixture") {
          const fx = fixtures.find(f => f.id === selected.fixtureId);
          if (fx?.editor?.locked) return;
          setDeleteConfirm({ key: "fixture", message: `Delete architectural fixture "${fx?.label || fx?.id}"? This cannot be undone.` });
        } else if (selected.type === "label") {
          const lbl = labels.find(l => l.id === selected.labelId);
          setDeleteConfirm({ key: "label", message: `Delete text label "${lbl?.label || lbl?.id}"? This cannot be undone.` });
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "y") {
        e.preventDefault();
        redo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d" && editMode && selected) {
        e.preventDefault();
        if (selected.type === "table" && selectedTable) duplicateTable(selectedTable);
        else if (selected.type === "standaloneSeat" && selectedStandaloneSeatObj) duplicateStandaloneSeat(selectedStandaloneSeatObj);
        else if (selected.type === "fixture" && selectedFixtureObj) duplicateFixture(selectedFixtureObj);
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [editMode, selected, tables, standaloneSeats, fixtures, selectedTable, selectedStandaloneSeatObj, selectedFixtureObj, undo, redo]);

  const startTableDrag = useCallback((e, id) => {
    e.preventDefault();
    const t = tables.find(t => t.id === id);
    if (t?.editor?.locked) return;
    dragging.current = { type: "table", id, startX: e.clientX, startY: e.clientY, originX: t?.x || 0, originY: t?.y || 0, active: false };
  }, [tables]);

  const startTableResize = useCallback((e) => { e.preventDefault(); }, []);

  const startLabelDrag = useCallback((e, id) => {
    e.preventDefault(); const l = labels.find(l => l.id === id);
    dragging.current = { type: "label", id, startX: e.clientX, startY: e.clientY, originX: l?.x || 0, originY: l?.y || 0, active: false };
  }, [labels]);

  const startStandaloneSeatDrag = useCallback((e, id) => {
    e.preventDefault();
    const ss = standaloneSeats.find(s => s.id === id);
    if (ss?.editor?.locked) return;
    dragging.current = { type: "standaloneSeat", id, startX: e.clientX, startY: e.clientY, originX: ss?.x || 0, originY: ss?.y || 0, active: false };
  }, [standaloneSeats]);

  const startFixtureDrag = useCallback((e, id) => {
    e.preventDefault();
    const f = fixtures.find(f => f.id === id);
    if (f?.editor?.locked) return;
    dragging.current = { type: "fixture", id, startX: e.clientX, startY: e.clientY, originX: f?.x || 0, originY: f?.y || 0, active: false };
  }, [fixtures]);

  const addTablePreset = useCallback((preset) => {
    pushHistory();
    const cx = Math.max(40, (-pan.x + 200) / zoom);
    const cy = Math.max(40, (-pan.y + 200) / zoom);
    const t = makeTableFromPreset(preset, cx, cy);
    setTables(p => [...p, t]);
    setSelected({ type: "table", tableId: t.id });
  }, [pan, zoom, pushHistory]);

  const addFixturePreset = useCallback((preset) => {
    pushHistory();
    const cx = Math.max(40, (-pan.x + 200) / zoom);
    const cy = Math.max(40, (-pan.y + 200) / zoom);
    const f = makeFixtureFromPreset(preset, cx, cy);
    setFixtures(p => [...p, f]);
    setSelected({ type: "fixture", fixtureId: f.id });
  }, [pan, zoom, pushHistory]);

  const addLabelPreset = useCallback((preset) => {
    pushHistory();
    const id = `L-${Date.now()}`;
    const cx = Math.max(40, (-pan.x + 200) / zoom);
    const cy = Math.max(40, (-pan.y + 200) / zoom);
    const l = {
      id,
      type: preset.type,
      label: preset.defaultText,
      x: cx,
      y: cy
    };
    setLabels(p => [...p, l]);
    setSelected({ type: "label", labelId: id });
  }, [pan, zoom, pushHistory]);

  const addStandaloneSeatPreset = useCallback((preset) => {
    pushHistory();
    const n = _standaloneCounter++;
    const cx = Math.max(40, (-pan.x + 200) / zoom);
    const cy = Math.max(40, (-pan.y + 200) / zoom);
    const ss = {
      id: `SS${n}`, num: n, label: `S${n}`, status: "available", x: cx, y: cy,
      editor: { chair_style: preset.chair_style, rotation: 0, reservable: true, locked: false, width: preset.width, height: preset.height }
    };
    setStandaloneSeats(p => [...p, ss]);
    setSelected({ type: "standaloneSeat", standaloneSeatId: ss.id });
  }, [pan, zoom, pushHistory]);

  const duplicateFixture = useCallback((fixture) => {
    pushHistory();
    const id = `FX${_fixtureCounter++}`;
    const newFixture = {
      ...fixture,
      id,
      label: `${fixture.label || fixture.id} (Copy)`,
      x: Math.min(roomWidth - (fixture.width || 80), fixture.x + 30),
      y: Math.min(roomHeight - (fixture.height || 60), fixture.y + 30),
      editor: {
        ...(fixture.editor || {}),
        rotation: fixture.editor?.rotation || 0,
        locked: false,
      }
    };
    setFixtures(p => [...p, newFixture]);
    setSelected({ type: "fixture", fixtureId: id });
  }, [fixtures, roomWidth, roomHeight, pushHistory]);

  const updateLabel = (k, v) => {
    if (!selected?.labelId) return;
    pushHistory();
    setLabels(p => p.map(l => l.id === selected.labelId ? { ...l, [k]: v } : l));
  };

  const updateFixture = (k, v) => {
    if (!selected?.fixtureId) return;
    pushHistory();
    setFixtures(p => p.map(f => {
      if (f.id !== selected.fixtureId) return f;
      if (k === "editor") {
        return { ...f, editor: { ...(f.editor || {}), ...v } };
      }
      return { ...f, [k]: v };
    }));
  };

  const deleteFixture = useCallback((id) => {
    const fid = id || selected?.fixtureId;
    if (!fid) return;
    const fixtureToDelete = fixtures.find(f => f.id === fid);
    if (fixtureToDelete?.editor?.locked) return;

    pushHistory();
    setFixtures(p => p.filter(f => f.id !== fid));
    if (!id || selected?.fixtureId === fid) setSelected(null);
  }, [selected, fixtures, pushHistory]);

  const handleCanvasClick = e => {
    if (!editMode) return;
    const rect = canvasRef.current?.getBoundingClientRect();
    const cx = Math.max(0, (e.clientX - rect.left) / zoom), cy = Math.max(0, (e.clientY - rect.top) / zoom);

    if (tool === "addTable") {
      pushHistory();
      const t = makeTable(cx - 55, cy - 27);
      setTables(p => [...p, t]);
      setSelected({ type: "table", tableId: t.id });
      setTool("select");
    }
    else if (tool === "addSeat") {
      pushHistory();
      const ss = makeStandaloneSeat(cx - 19, cy - 19);
      setStandaloneSeats(p => [...p, ss]);
      setSelected({ type: "standaloneSeat", standaloneSeatId: ss.id });
      setTool("select");
    }
  };

  const handleDragOver = e => {
    if (!editMode) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = e => {
    if (!editMode) return;
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData("application/react-preset");
      if (!dataStr) return;
      const { preset, presetType } = JSON.parse(dataStr);
      if (!preset || !presetType) return;

      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      // Convert page coordinates to canvas space (accounting for offset, zoom, pan)
      let cx = (e.clientX - rect.left) / zoom;
      let cy = (e.clientY - rect.top) / zoom;

      // Center the dropped preset based on its dimensions
      const w = preset.width || (presetType === "table" ? 110 : presetType === "fixture" ? 80 : 38);
      const h = preset.height || (presetType === "table" ? 70 : presetType === "fixture" ? 60 : 38);

      cx = cx - w / 2;
      cy = cy - h / 2;

      // Bound within the room canvas boundary limits
      cx = Math.max(0, Math.min(roomWidth - w, cx));
      cy = Math.max(0, Math.min(roomHeight - h, cy));

      // Snap to grid if grid alignment is enabled
      if (snapToGrid) {
        cx = Math.round(cx / gridSize) * gridSize;
        cy = Math.round(cy / gridSize) * gridSize;
      }

      pushHistory();

      if (presetType === "table") {
        const t = makeTableFromPreset(preset, cx, cy);
        setTables(p => [...p, t]);
        setSelected({ type: "table", tableId: t.id });
      } else if (presetType === "standaloneSeat") {
        const n = _standaloneCounter++;
        const ss = {
          id: `SS${n}`,
          num: n,
          label: `S${n}`,
          status: "available",
          x: cx,
          y: cy,
          editor: {
            chair_style: preset.chair_style,
            rotation: 0,
            reservable: true,
            locked: false,
            width: preset.width,
            height: preset.height
          }
        };
        setStandaloneSeats(p => [...p, ss]);
        setSelected({ type: "standaloneSeat", standaloneSeatId: ss.id });
      } else if (presetType === "fixture") {
        const f = makeFixtureFromPreset(preset, cx, cy);
        setFixtures(p => [...p, f]);
        setSelected({ type: "fixture", fixtureId: f.id });
      } else if (presetType === "label") {
        const id = `L-${Date.now()}`;
        const l = {
          id,
          type: preset.type,
          label: preset.defaultText,
          x: cx,
          y: cy
        };
        setLabels(p => [...p, l]);
        setSelected({ type: "label", labelId: id });
      }
    } catch (err) {
      console.error("[SeatMap] Error in drop handler: ", err);
    }
  };

  const handleRequestDelete = key => {
    if (key === "table") {
      const tbl = selectedTable || tables.find(t => t.id === selected?.tableId);
      if (tbl?.editor?.locked) return;
      setDeleteConfirm({ key, message: `Delete "${tbl?.label || tbl?.id || "this table"}"? This will also remove all ${tbl?.seats?.length || 0} seats and cannot be undone.` });
    } else if (key === "seat") {
      setDeleteConfirm({ key, message: `Delete seat "${selectedSeatObj?.label || selectedSeatObj?.num}"? This cannot be undone.` });
    } else if (key === "standaloneSeat") {
      const ss = standaloneSeats.find(s => s.id === selected?.standaloneSeatId);
      if (ss?.editor?.locked) return;
      setDeleteConfirm({ key, message: "Delete this standalone seat? This cannot be undone." });
    } else if (key === "fixture") {
      const fx = selectedFixtureObj || fixtures.find(f => f.id === selected?.fixtureId);
      if (fx?.editor?.locked) return;
      setDeleteConfirm({ key, message: `Delete architectural fixture "${fx?.label || fx?.id || "this fixture"}"? This cannot be undone.` });
    } else if (key === "label") {
      const lbl = selectedLabelObj || labels.find(l => l.id === selected?.labelId);
      setDeleteConfirm({ key, message: `Delete text label "${lbl?.label || lbl?.id || "this label"}"? This cannot be undone.` });
    }
  };

  const handleConfirmDelete = async () => {
    const key = deleteConfirm?.key;
    setDeleteConfirm(null);
    if (key === "table") await deleteTable();
    else if (key === "seat") await deleteSeat();
    else if (key === "standaloneSeat") await deleteStandaloneSeat();
    else if (key === "bulkDeleteStandaloneSeats") await deleteBulkStandaloneSeats();
    else if (key === "fixture") {
      pushHistory();
      setFixtures(p => p.filter(f => f.id !== selected?.fixtureId));
      setSelected(null);
    } else if (key === "label") {
      pushHistory();
      setLabels(p => p.filter(l => l.id !== selected?.labelId));
      setSelected(null);
    }
  };

  const deleteTable = async id => {
    const tid = id || selected?.tableId;
    if (!tid) return;
    const tableToDelete = tables.find(t => t.id === tid);
    if (tableToDelete?.editor?.locked) return;

    pushHistory();
    if (tableToDelete) {
      try { await cleanupReservationsForDeletedTable(tableToDelete, activeWing, activeRoom, "admin"); } catch { }
    }
    setTables(p => p.filter(t => t.id !== tid));
    if (!id || selected?.tableId === tid) setSelected(null);
  };

  const deleteStandaloneSeat = async id => {
    const sid = id || selected?.standaloneSeatId;
    if (!sid) return;
    const seatToDelete = standaloneSeats.find(s => s.id === sid);
    if (seatToDelete?.editor?.locked) return;

    pushHistory();
    if (seatToDelete) {
      try { await cleanupReservationsForDeletedStandaloneSeat(seatToDelete, activeWing, activeRoom, "admin"); } catch { }
    }
    setStandaloneSeats(p => p.filter(s => s.id !== sid));
    if (!id || selected?.standaloneSeatId === sid) setSelected(null);
  };

  const deleteBulkStandaloneSeats = async () => {
    if (selectedStandaloneSeats.size === 0) return;
    const seatsToDelete = standaloneSeats.filter(s => selectedStandaloneSeats.has(s.id) && !s.editor?.locked);

    pushHistory();
    for (const seat of seatsToDelete) {
      try { await cleanupReservationsForDeletedStandaloneSeat(seat, activeWing, activeRoom, "admin"); } catch { }
    }
    setStandaloneSeats(p => p.filter(s => !selectedStandaloneSeats.has(s.id)));
    setSelectedStandaloneSeats(new Set());
    setSelected(null);
  };

  const addSeat = useCallback((tableId) => {
    const tid = tableId || selected?.tableId;
    if (!tid) return;
    pushHistory();
    setTables(p => p.map(t => {
      if (t.id !== tid) return t;
      const existingNums = (t.seats || []).map(s => s.num);
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
  }, [selected, pushHistory]);

  const deleteSeat = async () => {
    if (!selected?.tableId) return;
    const table = tables.find(t => t.id === selected.tableId);
    if (table?.editor?.locked) return;

    if (table?.seats?.length > 0) {
      const lastSeat = table.seats[table.seats.length - 1];
      if (lastSeat.status !== "available") {
        const confirm = window.confirm("Warning: The last seat has a pending or active booking. Are you sure you want to remove it?");
        if (!confirm) return;
      }

      pushHistory();
      try { await cleanupReservationsForDeletedSeat(lastSeat, table, activeWing, activeRoom, "admin"); } catch { }
    }
    setTables(p => {
      const u = p.map(t => t.id !== selected.tableId ? t : { ...t, seats: (t.seats || []).slice(0, -1) });
      const f = u.filter(t => (t.seats || []).length > 0);
      if (f.length < u.length) setSelected(null);
      return f;
    });
  };

  const handleSeatCountChange = async (tableId, newCount) => {
    const table = tables.find(t => t.id === tableId);
    if (!table) return;
    const currentCount = table.seats?.length || 0;
    if (newCount < currentCount) {
      const truncated = table.seats.slice(newCount);
      const hasBookings = truncated.some(s => s.status !== "available");
      if (hasBookings) {
        const confirm = window.confirm("Warning: Some of the seats being removed have active or pending reservations. Are you sure you want to delete them? This will remove their bookings.");
        if (!confirm) return;
      }

      pushHistory();
      for (const seat of truncated) {
        try { await cleanupReservationsForDeletedSeat(seat, table, activeWing, activeRoom, "admin"); } catch { }
      }
      setTables(p => p.map(t => t.id === tableId ? {
        ...t,
        seats: t.seats.slice(0, newCount)
      } : t));
    } else {
      pushHistory();
      const seatsToAdd = newCount - currentCount;
      setTables(p => p.map(t => {
        if (t.id !== tableId) return t;
        const newSeats = [...(t.seats || [])];
        for (let i = 0; i < seatsToAdd; i++) {
          const num = newSeats.length + 1;
          newSeats.push({
            id: `${t.id}-S${num}-${Date.now()}`,
            num,
            label: `S${num}`,
            status: "available"
          });
        }
        return { ...t, seats: newSeats };
      }));
    }
  };

  const duplicateTable = useCallback((table) => {
    pushHistory();
    const id = `T${_tableCounter++}`;
    const newTable = {
      ...table,
      id,
      label: `${table.label || table.id} (Copy)`,
      x: Math.min(roomWidth - (table.width || 110), table.x + 30),
      y: Math.min(roomHeight - (table.height || 70), table.y + 30),
      seats: (table.seats || []).map((s, idx) => ({
        id: `${id}-S${idx + 1}-${Date.now()}`,
        num: idx + 1,
        label: `S${idx + 1}`,
        status: "available",
        position: s.position,
      })),
      editor: {
        ...(table.editor || {}),
        rotation: table.editor?.rotation || 0,
        locked: false,
      }
    };
    setTables(p => [...p, newTable]);
    setSelected({ type: "table", tableId: id });
  }, [tables, roomWidth, roomHeight, pushHistory]);

  const bringTableToFront = useCallback((tableId) => {
    pushHistory();
    setTables(p => {
      const target = p.find(t => t.id === tableId);
      if (!target) return p;
      const rest = p.filter(t => t.id !== tableId);
      return [...rest, target];
    });
  }, [pushHistory]);

  const sendTableToBack = useCallback((tableId) => {
    pushHistory();
    setTables(p => {
      const target = p.find(t => t.id === tableId);
      if (!target) return p;
      const rest = p.filter(t => t.id !== tableId);
      return [target, ...rest];
    });
  }, [pushHistory]);

  const duplicateStandaloneSeat = useCallback((seat) => {
    pushHistory();
    const n = _standaloneCounter++;
    const newSeat = {
      ...seat,
      id: `SS${n}`,
      num: n,
      label: `S${n}`,
      status: "available",
      x: Math.min(roomWidth - 38, seat.x + 20),
      y: Math.min(roomHeight - 38, seat.y + 20),
      editor: {
        locked: false
      }
    };
    setStandaloneSeats(p => [...p, newSeat]);
    setSelected({ type: "standaloneSeat", standaloneSeatId: newSeat.id });
  }, [standaloneSeats, roomWidth, roomHeight, pushHistory]);

  const exportLayout = useCallback(() => {
    const data = {
      v: 2,
      tables,
      labels,
      standaloneSeats,
      editor: {
        room_width_cm: roomWidth,
        room_height_cm: roomHeight,
        grid_cm: gridSize,
        snap_enabled: snapToGrid,
        show_grid: showGrid,
        grid_visibility: gridVisibility,
        smart_guides_enabled: smartGuidesEnabled,
        show_rulers: showRulers,
        canvas_bg_color: canvasBgColor
      }
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `layout-${activeRoom.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [tables, labels, standaloneSeats, roomWidth, roomHeight, gridSize, snapToGrid, activeRoom, showGrid, gridVisibility, smartGuidesEnabled, showRulers, canvasBgColor]);

  const importLayout = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        if (data.v === 2 && data.tables) {
          pushHistory();
          setTables(normalize(data.tables).filter(t => t.seats?.length > 0));
          setLabels(data.labels || DEFAULT_LABELS);
          setStandaloneSeats(data.standaloneSeats || []);
          if (data.editor) {
            if (data.editor.room_width_cm) setRoomWidth(data.editor.room_width_cm);
            if (data.editor.room_height_cm) setRoomHeight(data.editor.room_height_cm);
            if (data.editor.grid_cm) setGridSize(data.editor.grid_cm);
            if (data.editor.snap_enabled !== undefined) setSnapToGrid(data.editor.snap_enabled);
            if (data.editor.show_grid !== undefined) setShowGrid(data.editor.show_grid);
            if (data.editor.grid_visibility !== undefined) setGridVisibility(data.editor.grid_visibility);
            if (data.editor.smart_guides_enabled !== undefined) setSmartGuidesEnabled(data.editor.smart_guides_enabled);
            if (data.editor.show_rulers !== undefined) setShowRulers(data.editor.show_rulers);
            if (data.editor.canvas_bg_color) setCanvasBgColor(data.editor.canvas_bg_color);
          }
          alert("Layout imported successfully!");
        } else {
          alert("Invalid layout file structure. Make sure it is v2 layout JSON.");
        }
      } catch (err) {
        alert("Failed to parse layout JSON.");
      }
    };
    reader.readAsText(file);
  }, [pushHistory, normalize]);

  const resetLayout = useCallback(() => {
    const confirm = window.confirm("Are you sure you want to reset the layout of this room? This will clear all tables and standalone seats and cannot be undone!");
    if (!confirm) return;
    pushHistory();
    setTables([]);
    setStandaloneSeats([]);
    setLabels(DEFAULT_LABELS);
    setRoomWidth(1200);
    setRoomHeight(800);
    setGridSize(25);
    setSnapToGrid(true);
    setShowGrid(true);
    setGridVisibility(30);
    setSmartGuidesEnabled(true);
    setShowRulers(true);
    setCanvasBgColor("#FAF9F5");
    setSelected(null);
  }, [pushHistory]);

  const discardChanges = useCallback(() => {
    const confirm = window.confirm("Are you sure you want to discard all unsaved changes and restore the layout from the server?");
    if (!confirm) return;

    if (!tableData) return;
    pushHistory();
    if (tableData.v === 2) {
      setTables(normalize(tableData.tables || []).filter(t => t.seats?.length > 0));
      setLabels(tableData.labels?.length ? tableData.labels : DEFAULT_LABELS);
      setStandaloneSeats(tableData.standaloneSeats || []);
      setFixtures(tableData.fixtures || []);
      if (tableData.editor) {
        if (tableData.editor.room_width_cm) setRoomWidth(tableData.editor.room_width_cm);
        if (tableData.editor.room_height_cm) setRoomHeight(tableData.editor.room_height_cm);
        setCanvasBgColor(tableData.editor.canvas_bg_color || "#FAF9F5");
        setCanvasBgOpacity(tableData.editor.canvas_bg_opacity !== undefined ? tableData.editor.canvas_bg_opacity : 100);
        setCanvasBgVisible(tableData.editor.canvas_bg_visible !== undefined ? tableData.editor.canvas_bg_visible : true);
      } else {
        setCanvasBgColor("#FAF9F5");
        setCanvasBgOpacity(100);
        setCanvasBgVisible(true);
      }
    } else if (tableData.tables) {
      setTables(normalize(tableData.tables).filter(t => t.seats?.length > 0));
      setLabels(tableData.labels?.length ? tableData.labels : DEFAULT_LABELS);
      setStandaloneSeats(tableData.standaloneSeats || []);
      setFixtures(tableData.fixtures || []);
      if (tableData.editor) {
        if (tableData.editor.canvas_bg_color) setCanvasBgColor(tableData.editor.canvas_bg_color);
        setCanvasBgOpacity(tableData.editor.canvas_bg_opacity !== undefined ? tableData.editor.canvas_bg_opacity : 100);
        setCanvasBgVisible(tableData.editor.canvas_bg_visible !== undefined ? tableData.editor.canvas_bg_visible : true);
      } else {
        setCanvasBgColor("#FAF9F5");
        setCanvasBgOpacity(100);
        setCanvasBgVisible(true);
      }
    } else if (Array.isArray(tableData)) {
      setTables(normalize(tableData).filter(t => t.seats?.length > 0));
      setLabels(DEFAULT_LABELS); setStandaloneSeats([]); setFixtures([]);
      setCanvasBgColor("#FAF9F5");
      setCanvasBgOpacity(100);
      setCanvasBgVisible(true);
    }
    setSelected(null);
  }, [tableData, normalize, pushHistory]);

  const updateTable = (k, v) => {
    if (!selected?.tableId) return;
    pushHistory();
    setTables(p => p.map(t => {
      if (t.id !== selected.tableId) return t;
      if (k === "editor") {
        return { ...t, editor: { ...(t.editor || {}), ...v } };
      }
      return { ...t, [k]: v };
    }));
  };

  const handleLabelEdit = (id, val) => { pushHistory(); setTables(p => p.map(t => t.id === id ? { ...t, label: val } : t)); };
  const handleSeatLabelEdit = val => { if (!selected?.seatId) return; pushHistory(); setTables(p => p.map(t => t.id !== selected.tableId ? t : { ...t, seats: (t.seats || []).map(s => s.id === selected.seatId ? { ...s, label: val } : s) })); };
  const handleSeatStatus = status => { if (!selected?.seatId) return; pushHistory(); setTables(p => p.map(t => t.id !== selected.tableId ? t : { ...t, seats: (t.seats || []).map(s => s.id === selected.seatId ? { ...s, status } : s) })); };
  const handleSeatMove = (tableId, seatId, pos) => { pushHistory(); setTables(p => p.map(t => t.id !== tableId ? t : { ...t, seats: (t.seats || []).map(s => s.id === seatId ? { ...s, position: pos } : s) })); };
  const handleStandaloneSeatStatus = (seatId, status) => { pushHistory(); setStandaloneSeats(p => p.map(s => s.id === seatId ? { ...s, status } : s)); };
  const handleSeatClick = (seat, tableId) => { if (!editMode) { onSeatClick?.(seat, tableId); return; } setSelected({ type: "seat", tableId, seatId: seat.id }); };
  const handleTableSelect = table => { if (editMode) { setSelected({ type: "table", tableId: table.id }); return; } onTableClick?.(table); };
  const handleSelectRoom = (w, r) => { setActiveWing(w); setActiveRoom(r); };
  const handleSaveVenue = newStructure => { setVenueStructure(newStructure); saveVenueStructure(newStructure); };

  const [emptyCanvasWarning, setEmptyCanvasWarning] = useState(false);

  const handlePublishClick = () => {
    setPublishError("");
    // Detect empty canvas scenario
    const isEmpty = tables.length === 0 && standaloneSeats.length === 0;
    setEmptyCanvasWarning(isEmpty);
    setShowPublishModal(true);
  };

  const executePublish = async () => {
    const matchedVenue = venuesList.find(v => v.name === activeRoom);
    if (!matchedVenue) return;

    setPublishError("");
    const result = await publishSeatmap(matchedVenue.id);
    if (result && result.success) {
      setSaved(true);
      setIsDraft(false);
      setShowPublishModal(false);
      setEmptyCanvasWarning(false);
      setTimeout(() => setSaved(false), 2500);
    } else {
      setPublishError(result?.message || "Failed to publish layout. Please try again.");
    }
  };



  // ─── ADMIN / EDIT VIEW ────────────────────────────────────────────────────────
  const isAddMode = tool === "addTable" || tool === "addSeat";
  const isDeleteMode = tool === "deleteSeat";
  const isMultiSelectMode = tool === "multiSelect";
  const toolHint = {
    addTable: "Click on canvas to place a table",
    addSeat: "Click on canvas to place a standalone seat",
    deleteSeat: "Click on any standalone seat to delete it",
    multiSelect: "Click standalone seats to select multiple for bulk deletion",
  }[tool] || "";

  // Spacebar grab panning key listeners
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === "Space" && e.target === document.body) {
        e.preventDefault();
        setSpacePressed(true);
      }
    };
    const handleKeyUp = (e) => {
      if (e.code === "Space") {
        setSpacePressed(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // Viewport Zoom wheel listener (Focal zooming centered on cursor)
  useEffect(() => {
    const el = canvasViewportRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      const newZoom = Math.min(3.0, Math.max(0.15, zoom * zoomFactor));
      const rect = el.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      setPan(prev => ({
        x: mouseX - (mouseX - prev.x) * (newZoom / zoom),
        y: mouseY - (mouseY - prev.y) * (newZoom / zoom)
      }));
      setZoom(newZoom);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom]);



  useEffect(() => {
    if (!isPanning) return;
    const handleMouseMove = (e) => {
      console.log('[SeatMap] handleMouseMove panning to:', e.clientX - panStart.current.x, e.clientY - panStart.current.y);
      setPan({
        x: e.clientX - panStart.current.x,
        y: e.clientY - panStart.current.y
      });
    };
    const handleMouseUp = () => {
      setIsPanning(false);
    };

    const handleTouchMove = (e) => {
      // Prevent screen scrolling when dragging the canvas
      if (e.cancelable) e.preventDefault();
      
      if (e.touches.length === 1 && touchStartDist.current === null) {
        const touch = e.touches[0];
        setPan({
          x: touch.clientX - panStart.current.x,
          y: touch.clientY - panStart.current.y
        });
      } else if (e.touches.length === 2 && touchStartDist.current !== null) {
        const t1 = e.touches[0];
        const t2 = e.touches[1];
        const dist = Math.hypot(t1.clientX - t2.clientX, t1.clientY - t2.clientY);
        const factor = dist / touchStartDist.current;
        const newZoom = Math.min(3.0, Math.max(0.15, touchStartZoom.current * factor));
        
        const midX = (t1.clientX + t2.clientX) / 2;
        const midY = (t1.clientY + t2.clientY) / 2;
        const el = canvasViewportRef.current;
        if (el) {
          const rect = el.getBoundingClientRect();
          const localX = midX - rect.left;
          const localY = midY - rect.top;
          setPan(prev => ({
            x: localX - (localX - prev.x) * (newZoom / zoom),
            y: localY - (localY - prev.y) * (newZoom / zoom)
          }));
        }
        setZoom(newZoom);
      }
    };

    const handleTouchEnd = (e) => {
      if (e.touches.length === 0) {
        setIsPanning(false);
        touchStartDist.current = null;
      } else if (e.touches.length === 1) {
        const touch = e.touches[0];
        panStart.current = { x: touch.clientX - pan.x, y: touch.clientY - pan.y };
        touchStartDist.current = null;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("touchmove", handleTouchMove, { passive: false });
    window.addEventListener("touchend", handleTouchEnd);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [isPanning, zoom]);

  // Dot Grid pattern drawing
  const renderDotGrid = () => {
    if (showGrid === false) return null;
    const isDarkBg = canvasBgVisible && isDarkColor(canvasBgColor) && canvasBgOpacity > 40;
    const baseOpacity = isDarkBg
      ? Math.min(1.0, ((gridVisibility !== undefined ? gridVisibility : 30) * 1.35) / 100)
      : ((gridVisibility !== undefined ? gridVisibility : 30) / 100);
    const gridColor = isDarkBg ? "#FAF3E0" : C.gold;
    return (
      <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none", opacity: baseOpacity }}>
        <defs>
          <pattern id="dotGrid" width={gridSize} height={gridSize} patternUnits="userSpaceOnUse">
            <circle cx={2} cy={2} r={1.5} fill={gridColor} />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#dotGrid)" />
      </svg>
    );
  };

  // Horizontal Ruler drawing
  const renderHorizontalRuler = () => {
    if (showRulers === false) return null;
    const ticks = [];
    const step = 10; // cm
    for (let x = 0; x <= roomWidth; x += step) {
      const isMajor = x % 50 === 0;
      ticks.push(
        <g key={`h-tick-${x}`} transform={`translate(${x}, 0)`}>
          <line x1={0} y1={isMajor ? 0 : 10} x2={0} y2={20} stroke={C.borderStrong} strokeWidth={1} />
          {isMajor && (
            <text x={3} y={9} fontSize={7} fontFamily="monospace" fill={C.textSecondary} fontWeight={600} textAnchor="start">
              {x}
            </text>
          )}
        </g>
      );
    }
    return (
      <div style={{ position: "absolute", top: 0, left: 24, right: 0, height: 20, background: C.surfaceRaised, borderBottom: `1px solid ${C.borderDefault}`, overflow: "hidden", zIndex: 10, pointerEvents: "none", userSelect: "none" }}>
        <svg style={{ width: "100%", height: "100%" }}>
          <g transform={`translate(${pan.x}, 0) scale(${zoom}, 1)`}>
            {ticks}
          </g>
        </svg>
      </div>
    );
  };

  // Vertical Ruler drawing
  const renderVerticalRuler = () => {
    if (showRulers === false) return null;
    const ticks = [];
    const step = 10; // cm
    for (let y = 0; y <= roomHeight; y += step) {
      const isMajor = y % 50 === 0;
      ticks.push(
        <g key={`v-tick-${y}`} transform={`translate(0, ${y})`}>
          <line x1={isMajor ? 0 : 10} y1={0} x2={20} y2={0} stroke={C.borderStrong} strokeWidth={1} />
          {isMajor && (
            <text x={3} y={7} fontSize={7} fontFamily="monospace" fill={C.textSecondary} fontWeight={600} transform="rotate(-90 3 7)">
              {y}
            </text>
          )}
        </g>
      );
    }
    return (
      <div style={{ position: "absolute", top: 20, left: 0, width: 24, bottom: 0, background: C.surfaceRaised, borderRight: `1px solid ${C.borderDefault}`, overflow: "hidden", zIndex: 10, pointerEvents: "none", userSelect: "none" }}>
        <svg style={{ width: "100%", height: "100%" }}>
          <g transform={`translate(0, ${pan.y}) scale(1, ${zoom})`}>
            {ticks}
          </g>
        </svg>
      </div>
    );
  };

  const handleHudSeatCount = async (newCount) => {
    if (!selectedTable) return;
    await handleSeatCountChange(selectedTable.id, newCount);
  };

  // ─── CLIENT VIEW ──────────────────────────────────────────────────────────────
  if (!editMode) {
    return (
      <div 
        style={{ 
          width: "100%", 
          height: "100%", 
          background: canvasBgVisible ? hexToRgba(canvasBgColor, canvasBgOpacity) : "transparent", 
          transition: "background 0.30s",
          position: "relative",
          overflow: "hidden"
        }}
      >
        {/* Scrollable Viewport Canvas Container */}
        <div
          ref={canvasViewportRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            overflow: "hidden",
            cursor: isPanning ? "grabbing" : "grab",
            userSelect: "none"
          }}
          onMouseDown={handleViewportMouseDown}
          onTouchStart={handleViewportTouchStart}
        >
          {/* Inner zoomable/panable sheet canvas of roomWidth x roomHeight */}
          <div
            ref={canvasRef}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              width: roomWidth,
              height: roomHeight,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "top left",
              background: "#FFFFFF",
              boxShadow: "0 12px 48px rgba(0,0,0,0.12)",
              transition: isPanning ? "none" : "transform 0.08s ease-out",
              border: "1px dashed rgba(140, 107, 42, 0.25)"
            }}
          >
            {labels.map(l => <StaticLabel key={`${wing}-${room}-label-${l.id}`} item={l} T={T} />)}
            {fixtures.map((f, index) => (
              <FixtureNode key={`${wing}-${room}-fixture-${f.id}-${index}`} fixture={f}
                editMode={false} isSelected={false} onSelect={() => { }} onDragStart={() => { }} isDragging={false} T={T} />
            ))}
            {standaloneSeats.map(s => (
              <StandaloneSeat key={`${wing}-${room}-standalone-${s.id}`} seat={s}
                editMode={false} isSelected={selectedSeat ? (selectedSeat.parentTableId ? selectedSeat.id === s.id && selectedSeat.parentTableId === "STANDALONE" : selectedSeat.id === s.id) : false}
                isDragging={false} onDragStart={() => { }} onSelect={() => { }}
                onSeatClick={mode === "individual" ? onSeatClick : undefined} T={T} />
            ))}
            {tables.map(t => (
              <TableNode key={`${wing}-${room}-table-${t.id}`} table={t}
                editMode={false} isTableSelected={highlightedTable ? highlightedTable.id === t.id : false}
                selectedSeatId={selectedSeat ? (selectedSeat.parentTableId ? (selectedSeat.parentTableId === t.id ? selectedSeat.id : null) : selectedSeat.id) : null}
                onSelectTable={handleTableSelect} onDragStart={() => { }} onResizeStart={() => { }}
                onSeatClick={handleSeatClick} isDragging={false} T={T} wing={wing} room={room} mode={mode} />
            ))}
          </div>
        </div>

        {/* Viewport Floating Zoom controls */}
        <div style={{ 
          position: "absolute", 
          bottom: 12, 
          right: 12, 
          display: "flex", 
          gap: 6, 
          zIndex: 100, 
          background: isDark ? "rgba(10, 9, 8, 0.88)" : "rgba(255, 255, 255, 0.90)", 
          backdropFilter: "blur(6px)", 
          WebkitBackdropFilter: "blur(6px)",
          padding: "4px 8px", 
          borderRadius: 8, 
          border: `1px solid ${T.borderDefault}`, 
          boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.40)" : "0 4px 16px rgba(0,0,0,0.06)", 
          alignItems: "center" 
        }}>
          <button 
            onClick={() => setZoom(prev => Math.min(3.0, prev + 0.1))} 
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textSecondary }} 
            title="Zoom In"
          >
            <ZoomIn size={13} />
          </button>
          <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "monospace", color: T.textPrimary, minWidth: 32, textAlign: "center" }}>
            {Math.round(zoom * 100)}%
          </div>
          <button 
            onClick={() => setZoom(prev => Math.max(0.15, prev - 0.1))} 
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textSecondary }} 
            title="Zoom Out"
          >
            <ZoomOut size={13} />
          </button>
          <div style={{ width: 1, height: 14, background: T.divider }} />
          <button 
            onClick={centerMap} 
            style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: T.textSecondary }} 
            title="Reset Map to Fit Screen"
          >
            <RotateCcw size={11} style={{ marginRight: 2 }} />
            <span style={{ fontSize: 8, fontWeight: 700, fontFamily: "inherit", color: T.gold, textTransform: "uppercase" }}>Fit</span>
          </button>
        </div>
      </div>
    );
  }

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
          <ToolBtn active={tool === "select"} onClick={() => setTool("select")} label="Select" />
          <ToolBtn active={tool === "pan"} onClick={() => setTool("pan")} label="Grab Workspace" />
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
          {isDraft ? (
            <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: C.goldFaintest, color: C.gold, borderRadius: 5, fontFamily: F, fontWeight: 700, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", border: `1px solid ${C.borderAccent}` }}>
              Unpublished Draft
            </span>
          ) : (
            <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: C.greenFaint, color: C.green, borderRadius: 5, fontFamily: F, fontWeight: 700, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", border: `1px solid ${C.greenBorder}` }}>
              Published (v{layoutVersion})
            </span>
          )}

          {saved && (
            <span style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", background: C.greenFaint, color: C.green, borderRadius: 5, fontFamily: F, fontWeight: 700, fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", border: `1px solid ${C.greenBorder}`, animation: "sm-fadeIn 0.16s ease" }}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              Saved
            </span>
          )}

          <button onClick={handlePublishClick}
            disabled={!isDraft}
            style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 16px", background: isDraft ? C.gold : C.surfaceRaised, color: isDraft ? "#fff" : C.textTertiary, border: `1px solid ${isDraft ? C.gold : C.borderDefault}`, borderRadius: 7, fontFamily: F, fontWeight: 700, fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", cursor: isDraft ? "pointer" : "not-allowed", transition: "all 0.14s", boxShadow: isDraft ? "0 2px 8px rgba(140,107,42,0.20)" : "none" }}
            onMouseEnter={e => { if (isDraft) e.currentTarget.style.background = C.goldLight; }}
            onMouseLeave={e => { if (isDraft) e.currentTarget.style.background = C.gold; }}>
            <svg width="11" height="11" viewBox="0 0 14 14" fill="none"><path d="M2 2h8l2 2v8a1 1 0 01-1 1H3a1 1 0 01-1-1V2z" stroke="currentColor" strokeWidth="1.3" fill="none" /><rect x="4" y="8" width="6" height="4" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none" /><rect x="4.5" y="2" width="4" height="3" rx="0.5" stroke="currentColor" strokeWidth="1.3" fill="none" /></svg>
            {isDraft ? "Publish Layout" : "Up to Date"}
          </button>
        </div>
      </div>

      {showPublishModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(10, 9, 8, 0.6)", backdropFilter: "blur(6px)", zIndex: 100000, display: "flex", alignItems: "center", justifyContent: "center", animation: "sm-fadeIn 0.2s ease" }}>
          <div style={{ background: C.surfaceRaised, border: `1px solid ${C.borderDefault}`, borderRadius: 16, width: 380, padding: 24, boxShadow: "0 10px 40px rgba(0,0,0,0.2)", animation: "sm-slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <div style={{ width: 32, height: 32, borderRadius: 8, background: C.goldFaintest, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" /></svg>
              </div>
              <h3 style={{ fontFamily: F, fontSize: 16, fontWeight: 700, color: C.textPrimary, margin: 0 }}>Publish Layout?</h3>
            </div>

            <p style={{ fontFamily: F, fontSize: 13, color: C.textSecondary, lineHeight: 1.5, margin: "0 0 16px 0" }}>
              Publishing this layout will instantly update the live guest reservation page. Guests booking right now will immediately see this new layout.
            </p>

            {emptyCanvasWarning && (
              <div style={{ padding: "12px 14px", background: "#3a1a1a", border: "1px solid #8b3a3a", borderRadius: 10, color: "#ff9999", fontFamily: F, fontSize: 12, marginBottom: 16, lineHeight: 1.6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ff6666" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                  <strong style={{ color: "#ff6666", fontSize: 13 }}>Empty Layout Warning</strong>
                </div>
                This canvas has no tables or seats. Publishing it will <strong>remove</strong> the current guest-facing layout for this room. Guests will see an empty page.
              </div>
            )}

            {publishError && (
              <div style={{ padding: "10px 12px", background: C.redFaint, border: `1px solid ${C.redBorder}`, borderRadius: 8, color: C.red, fontFamily: F, fontSize: 12, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                {publishError}
              </div>
            )}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={() => setShowPublishModal(false)}
                style={{ padding: "10px 16px", background: "transparent", border: `1px solid ${C.borderStrong}`, borderRadius: 8, color: C.textSecondary, fontFamily: F, fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = C.surfaceHover} onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                Cancel
              </button>
              <button onClick={executePublish}
                style={{ padding: "10px 20px", background: C.gold, border: "none", borderRadius: 8, color: "#fff", fontFamily: F, fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", cursor: "pointer", transition: "all 0.15s", boxShadow: "0 2px 8px rgba(140,107,42,0.25)" }}
                onMouseEnter={e => e.currentTarget.style.background = C.goldLight} onMouseLeave={e => e.currentTarget.style.background = C.gold}>
                Confirm Publish
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main editor area */}
      <div style={{ flex: "1 1 0", minHeight: 0, display: "flex", overflow: "hidden" }}>
        <LeftSidebarPanel
          activeWing={activeWing} activeRoom={activeRoom} onSelect={handleSelectRoom}
          venueStructure={visibleVenueStructure}
          onOpenVenueManager={canManageVenues ? () => setShowVenueManager(true) : null}
          addTablePreset={addTablePreset}
          addFixturePreset={addFixturePreset}
          addLabelPreset={addLabelPreset}
          addStandaloneSeatPreset={addStandaloneSeatPreset}
        />

        {/* CAD Drafting Table Canvas Viewport */}
        <div style={{ flex: "1 1 0", minWidth: 0, padding: 14, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative", background: C.surfaceRaised }}>
          <div style={{ flex: "1 1 0", minHeight: 0, position: "relative", border: `1px solid ${C.borderDefault}`, borderRadius: 12, overflow: "hidden", background: C.canvasBg }}>

            {/* SVG rulers */}
            {renderHorizontalRuler()}
            {renderVerticalRuler()}

            {/* Corner Ruler intersection indicator */}
            <div style={{ position: "absolute", top: 0, left: 0, width: 24, height: 20, background: C.surfaceRaised, borderRight: `1px solid ${C.borderDefault}`, borderBottom: `1px solid ${C.borderDefault}`, zIndex: 11, display: "flex", alignItems: "center", justifyContent: "center", userSelect: "none" }}>
              <span style={{ fontSize: 7, fontWeight: 800, color: C.gold, fontFamily: "monospace" }}>cm</span>
            </div>

            {/* Scrollable Viewport Canvas Container */}
            <div
              ref={canvasViewportRef}
              style={{
                position: "absolute",
                top: 20,
                left: 24,
                right: 0,
                bottom: 0,
                overflow: "hidden",
                background: canvasBgVisible ? hexToRgba(canvasBgColor, canvasBgOpacity) : "transparent", // Dynamic workspace/viewport background
                cursor: isPanning ? "grabbing" : (spacePressed || tool === "pan") ? "grab" : isAddMode ? "crosshair" : "default",
                userSelect: "none"
              }}
              onMouseDown={handleViewportMouseDown}
              onTouchStart={handleViewportTouchStart}
              onClick={e => {
                if (e.target === canvasViewportRef.current) {
                  const dx = Math.abs(e.clientX - viewportClickStartRef.current.x);
                  const dy = Math.abs(e.clientY - viewportClickStartRef.current.y);
                  if (dx < 6 && dy < 6) {
                    setSelected(null);
                  }
                }
              }}
            >
              {/* Inner zoomable/panable sheet canvas of roomWidth x roomHeight */}
              <div
                ref={canvasRef}
                style={{
                  position: "absolute",
                  left: 0,
                  top: 0,
                  width: roomWidth,
                  height: roomHeight,
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: "top left",
                  background: "#FFFFFF", // Canvas sheet stays clean white
                  boxShadow: "0 12px 48px rgba(0,0,0,0.12)",
                  transition: isPanning ? "none" : "transform 0.08s ease-out",
                  border: "1px dashed rgba(140, 107, 42, 0.25)"
                }}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={e => { if (e.target !== canvasRef.current) return; if (tool === "select") setSelected(null); handleCanvasClick(e); }}
              >
                {/* Dot Grid */}
                {renderDotGrid()}

                {/* Alignment Guides */}
                {alignGuides && (
                  <svg style={{ position: "absolute", inset: 0, width: roomWidth, height: roomHeight, pointerEvents: "none", zIndex: 20 }}>
                    {alignGuides.x !== null && (
                      <line x1={alignGuides.x} y1={0} x2={alignGuides.x} y2={roomHeight} stroke={C.gold} strokeWidth={1} strokeDasharray="3 3" />
                    )}
                    {alignGuides.y !== null && (
                      <line x1={0} y1={alignGuides.y} x2={roomWidth} y2={alignGuides.y} stroke={C.gold} strokeWidth={1} strokeDasharray="3 3" />
                    )}
                  </svg>
                )}

                {/* Boundary Alert overlay */}
                {tables.map(t => {
                  const tw = t.width || 110;
                  const th = t.height || 70;
                  const outOfBounds = t.x < 0 || t.y < 0 || t.x + tw > roomWidth || t.y + th > roomHeight;
                  if (!outOfBounds) return null;
                  return (
                    <div key={`out-bounds-${t.id}`} style={{ position: "absolute", left: t.x, top: t.y, width: tw, height: th, border: `2.5px dashed ${C.red}`, borderRadius: 8, pointerEvents: "none", zIndex: 1, animation: "sm-spin 4s linear infinite", opacity: 0.25 }} />
                  );
                })}
                {fixtures.map(f => {
                  const fw = f.width || 80;
                  const fh = f.height || 60;
                  const outOfBounds = f.x < 0 || f.y < 0 || f.x + fw > roomWidth || f.y + fh > roomHeight;
                  if (!outOfBounds) return null;
                  return (
                    <div key={`out-bounds-${f.id}`} style={{ position: "absolute", left: f.x, top: f.y, width: fw, height: fh, border: `2.5px dashed ${C.red}`, borderRadius: 4, pointerEvents: "none", zIndex: 1, animation: "sm-spin 4s linear infinite", opacity: 0.25 }} />
                  );
                })}

                {/* Draggable Labels */}
                {labels.map((l, index) => (
                  <DraggableLabel key={`label-${l.id}-${index}`} item={l}
                    onDragStart={(e, id) => startLabelDrag(e, id)}
                    isDragging={activeDragId === l.id}
                    T={T} />
                ))}

                {/* Draggable Fixtures */}
                {fixtures.map((f, index) => (
                  <FixtureNode key={`fixture-${f.id}-${index}`} fixture={f} editMode={true}
                    isSelected={selected?.type === "fixture" && selected.fixtureId === f.id}
                    onSelect={fx => setSelected({ type: "fixture", fixtureId: fx.id })}
                    onDragStart={startFixtureDrag} isDragging={activeDragId === f.id} T={T} />
                ))}

                {/* Draggable Standalone Seats */}
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

                {/* Draggable Tables */}
                {tables.map((t, index) => {
                  const isColliding = tables.some(other => other.id !== t.id && checkCollision(t, other));
                  return (
                    <TableNode key={`table-${t.id}-${index}`} table={t} editMode={true}
                      isTableSelected={selected?.tableId === t.id}
                      isColliding={isColliding}
                      selectedSeatId={selected?.type === "seat" && selected?.tableId === t.id ? selected.seatId : null}
                      onSelectTable={handleTableSelect}
                      onDragStart={startTableDrag} onResizeStart={startTableResize}
                      onSeatClick={handleSeatClick} onLabelEdit={handleLabelEdit}
                      isDragging={activeDragId === t.id} onSeatMove={handleSeatMove}
                      T={T}
                      wing={activeWing} room={activeRoom} />
                  );
                })}

                {/* Relocated Table Quick Inspector outside scaled canvas container */}

                {/* Empty State visualizer */}
                {tables.length === 0 && standaloneSeats.length === 0 && fixtures.length === 0 && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", pointerEvents: "none", gap: 10, animation: "sm-fadeUp 0.3s ease" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 10, border: `1.5px dashed ${C.borderStrong}`, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.35 }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" /><line x1="12" y1="8" x2="12" y2="16" /><line x1="8" y1="12" x2="16" y2="12" /></svg>
                    </div>
                    <p style={{ color: C.textSecondary, fontSize: 12, fontFamily: F, margin: 0 }}>Empty canvas — use the toolbar to add tables or seats</p>
                  </div>
                )}
              </div>

              {/* Table Quick Inspector - Premium Viewport-Aware HUD */}
              {selected?.type === "table" && selectedTable && quickInspectorPosition && (() => {
                const presetId = selectedTable.editor?.preset_id || "custom-table";
                const preset = TABLE_PRESETS.find(p => p.id === presetId) || TABLE_PRESETS.find(p => p.id === "custom-table");
                const minChairs = preset?.minSeatCount ?? 0;
                const maxChairs = preset?.maxSeatCount ?? 8;
                const seatCount = selectedTable.seats?.length || 0;
                const isLocked = selectedTable.editor?.locked || false;

                const hudBg = isDark ? "rgba(22, 20, 16, 0.98)" : "rgba(252, 250, 246, 0.98)";
                const hudText = isDark ? "#EDE8DF" : "#18140E";
                const hudBorder = isDark ? "1px solid rgba(196, 163, 90, 0.45)" : "1px solid rgba(140, 107, 42, 0.35)";
                const hudShadow = isDark ? "0 12px 36px rgba(0,0,0,0.5)" : "0 12px 36px rgba(140, 107, 42, 0.12)";
                const secondaryText = isDark ? "#8A8278" : "#7A7060";

                return (
                  <div style={{
                    position: "absolute",
                    left: quickInspectorPosition.left,
                    top: quickInspectorPosition.top,
                    background: hudBg,
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    border: hudBorder,
                    borderRadius: "8px",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    boxShadow: hudShadow,
                    zIndex: 1000,
                    animation: "sm-fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)",
                    pointerEvents: "auto",
                    width: "280px",
                    color: hudText,
                    fontFamily: F
                  }}>
                    {/* Header */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, paddingBottom: "8px", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}` }}>
                      <div style={{ minWidth: 0, display: "flex", flexDirection: "column", gap: 3 }}>
                        <input
                          value={selectedTable.label || selectedTable.id}
                          onChange={e => updateTable("label", e.target.value)}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: hudText,
                            fontFamily: F,
                            fontWeight: 700,
                            fontSize: "12px",
                            outline: "none",
                            width: "180px",
                            borderBottom: `1px dashed ${isDark ? "rgba(196, 163, 90, 0.30)" : "rgba(140, 107, 42, 0.40)"}`,
                            padding: "2px 0"
                          }}
                          placeholder="Table Label"
                        />
                        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                          <span style={{
                            background: isDark ? "rgba(196, 163, 90, 0.15)" : "rgba(140, 107, 42, 0.08)",
                            color: isDark ? "#C4A35A" : "#8C6B2A",
                            fontSize: "8px",
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}>
                            {preset?.label || "Custom"}
                          </span>
                          <span style={{
                            background: isDark ? "rgba(255, 255, 255, 0.05)" : "rgba(0, 0, 0, 0.04)",
                            color: secondaryText,
                            fontSize: "8px",
                            fontWeight: 800,
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                            padding: "2px 6px",
                            borderRadius: "4px",
                          }}>
                            {seatCount} chairs
                          </span>
                        </div>
                      </div>

                      {/* Close button */}
                      <button
                        onClick={() => setSelected(null)}
                        style={{
                          background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                          border: "none",
                          color: secondaryText,
                          cursor: "pointer",
                          width: "20px",
                          height: "20px",
                          borderRadius: "50%",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "9px",
                          transition: "all 0.15s"
                        }}
                        onMouseEnter={e => e.currentTarget.style.color = hudText}
                        onMouseLeave={e => e.currentTarget.style.color = secondaryText}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Chair count control */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "8px", fontWeight: 800, color: secondaryText, letterSpacing: "0.08em", textTransform: "uppercase" }}>Chairs</span>
                        <input
                          type="number"
                          min={minChairs}
                          max={maxChairs}
                          value={seatCount}
                          onChange={e => handleSeatCountChange(selectedTable.id, Math.min(maxChairs, Math.max(minChairs, Number(e.target.value))))}
                          style={{
                            width: "36px",
                            background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                            border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                            borderRadius: "4px",
                            color: hudText,
                            fontSize: "10px",
                            fontFamily: "monospace",
                            textAlign: "center",
                            outline: "none"
                          }}
                        />
                      </div>
                      <input
                        type="range"
                        min={minChairs}
                        max={maxChairs}
                        value={seatCount}
                        onChange={e => handleSeatCountChange(selectedTable.id, Number(e.target.value))}
                        style={{ width: "100%", accentColor: C.gold, cursor: "pointer" }}
                      />
                    </div>

                    {/* Chair Style Selector */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <span style={{ fontSize: "8px", fontWeight: 800, color: secondaryText, letterSpacing: "0.08em", textTransform: "uppercase" }}>Chair Style</span>
                      <select
                        value={selectedTable.editor?.chair_style || "standard-dining"}
                        onChange={e => updateTable("editor", { chair_style: e.target.value })}
                        style={{
                          width: "100%",
                          padding: "6px 8px",
                          background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.04)",
                          border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`,
                          borderRadius: "6px",
                          color: hudText,
                          fontSize: "11px",
                          fontFamily: F,
                          outline: "none",
                          cursor: "pointer"
                        }}
                      >
                        {CHAIR_STYLES.map(c => (
                          <option key={c.id} value={c.id} style={{ background: isDark ? "#161410" : "#FCFAF6", color: hudText }}>{c.label}</option>
                        ))}
                      </select>
                    </div>

                    {/* Spacing Slider */}
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "8px", fontWeight: 800, color: secondaryText, letterSpacing: "0.08em", textTransform: "uppercase" }}>Chair Spacing</span>
                        <span style={{ fontSize: "9px", fontFamily: "monospace", color: C.gold }}>{selectedTable.editor?.seat_spacing_cm || 8}cm</span>
                      </div>
                      <input
                        type="range"
                        min="4"
                        max="16"
                        value={selectedTable.editor?.seat_spacing_cm || 8}
                        onChange={e => updateTable("editor", { seat_spacing_cm: Number(e.target.value) })}
                        style={{ width: "100%", accentColor: C.gold, cursor: "pointer" }}
                      />
                    </div>

                    {/* Spacing and Lock Toggle */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "4px" }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", userSelect: "none" }}>
                        <input
                          type="checkbox"
                          checked={isLocked}
                          onChange={e => updateTable("editor", { locked: e.target.checked })}
                          style={{ accentColor: C.gold }}
                        />
                        <span style={{ fontSize: "9px", color: secondaryText, textTransform: "uppercase", fontWeight: 800 }}>Locked</span>
                      </label>
                    </div>

                    {/* Footer Actions */}
                    <div style={{ display: "flex", gap: 6, paddingTop: "8px", borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)"}`, marginTop: "2px" }}>
                      <button
                        onClick={() => bringTableToFront(selectedTable.id)}
                        style={{ flex: 1, padding: "5px 0", background: "transparent", border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`, borderRadius: "4px", color: hudText, fontSize: "9px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
                        title="Bring to Front"
                      >
                        ▲ Front
                      </button>
                      <button
                        onClick={() => sendTableToBack(selectedTable.id)}
                        style={{ flex: 1, padding: "5px 0", background: "transparent", border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`, borderRadius: "4px", color: hudText, fontSize: "9px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
                        title="Send to Back"
                      >
                        ▼ Back
                      </button>
                      <button
                        onClick={() => duplicateTable(selectedTable)}
                        style={{ flex: 1, padding: "5px 0", background: "transparent", border: `1px solid ${isDark ? "rgba(196, 163, 90, 0.40)" : "rgba(140, 107, 42, 0.35)"}`, borderRadius: "4px", color: C.gold, fontSize: "9px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
                        title="Duplicate"
                      >
                        Copy
                      </button>
                      <button
                        onClick={() => handleRequestDelete("table")}
                        style={{ flex: 1, padding: "5px 0", background: "transparent", border: `1px solid ${isDark ? "rgba(255,255,255,0.10)" : "rgba(0,0,0,0.08)"}`, borderRadius: "4px", color: C.red, fontSize: "9px", fontWeight: 700, cursor: "pointer", transition: "all 0.15s" }}
                        title="Delete Safely"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Viewport Floating Zoom controls */}
            <div style={{ position: "absolute", bottom: 16, right: 16, display: "flex", gap: 6, zIndex: 10, background: "rgba(255, 255, 255, 0.90)", backdropFilter: "blur(6px)", padding: "4px 8px", borderRadius: 8, border: `1px solid ${C.borderDefault}`, boxShadow: "0 4px 16px rgba(0,0,0,0.06)", alignItems: "center" }}>
              <button onClick={() => setZoom(prev => Math.min(3.0, prev + 0.1))} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: C.textSecondary }} title="Zoom In">
                <ZoomIn size={13} />
              </button>
              <div style={{ fontSize: 9, fontWeight: 700, fontFamily: "monospace", color: C.textPrimary, minWidth: 32, textAlign: "center" }}>
                {Math.round(zoom * 100)}%
              </div>
              <button onClick={() => setZoom(prev => Math.max(0.15, prev - 0.1))} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: C.textSecondary }} title="Zoom Out">
                <ZoomOut size={13} />
              </button>
              <div style={{ width: 1, height: 14, background: C.divider }} />
              <button onClick={centerMap} style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 9, fontWeight: 700, color: C.gold, fontFamily: F, padding: "2px 4px" }} title="Reset Viewport Pan and Zoom">
                Fit
              </button>
              <div style={{ width: 1, height: 14, background: C.divider }} />
              <button onClick={() => setSnapToGrid(prev => !prev)} style={{ background: snapToGrid ? `${C.gold}15` : "transparent", border: "none", borderRadius: 4, cursor: "pointer", padding: "4px 6px", color: snapToGrid ? C.gold : C.textSecondary, display: "flex", alignItems: "center" }} title="Toggle Snapping Grid">
                <Grid size={13} />
              </button>
            </div>

          </div>
        </div>

        {/* Sidebar details inspector */}
        <div className="sm-scroll" style={{ flexShrink: 0, width: 252, borderLeft: `1px solid ${C.borderDefault}`, background: C.surfaceBase, overflowY: "auto", padding: "14px 13px 24px", display: "flex", flexDirection: "column", gap: 0 }}>
          <InspectorPanel
            selected={selected} selectedTable={selectedTable} selectedSeatObj={selectedSeatObj}
            selectedStandaloneSeatObj={selectedStandaloneSeatObj}
            selectedLabelObj={selectedLabelObj} selectedFixtureObj={selectedFixtureObj}
            tables={tables} setTables={setTables}
            labels={labels} setLabels={setLabels}
            fixtures={fixtures} setFixtures={setFixtures}
            standaloneSeats={standaloneSeats}
            addSeat={addSeat} deleteSeat={deleteSeat} deleteTable={deleteTable}
            deleteStandaloneSeat={deleteStandaloneSeat} deleteFixture={deleteFixture}
            updateTable={updateTable} updateLabel={updateLabel} updateFixture={updateFixture}
            handleSeatLabelEdit={handleSeatLabelEdit} handleSeatStatus={handleSeatStatus}
            handleStandaloneSeatStatus={handleStandaloneSeatStatus} onRequestDelete={handleRequestDelete}
            duplicateTable={duplicateTable} duplicateStandaloneSeat={duplicateStandaloneSeat} duplicateFixture={duplicateFixture}
            snapToGrid={snapToGrid} setSnapToGrid={setSnapToGrid}
            gridSize={gridSize} setGridSize={setGridSize}
            roomWidth={roomWidth} setRoomWidth={setRoomWidth}
            roomHeight={roomHeight} setRoomHeight={setRoomHeight}
            undo={undo} redo={redo}
            canUndo={history.past.length > 0} canRedo={history.future.length > 0}
            exportLayout={exportLayout} importLayout={importLayout}
            resetLayout={resetLayout}
            handleSeatCountChange={handleSeatCountChange}
            pushHistory={pushHistory}
            showGrid={showGrid} setShowGrid={setShowGrid}
            gridVisibility={gridVisibility} setGridVisibility={setGridVisibility}
            smartGuidesEnabled={smartGuidesEnabled} setSmartGuidesEnabled={setSmartGuidesEnabled}
            showRulers={showRulers} setShowRulers={setShowRulers}
            canvasBgColor={canvasBgColor} setCanvasBgColor={setCanvasBgColor}
            canvasBgOpacity={canvasBgOpacity} setCanvasBgOpacity={setCanvasBgOpacity}
            canvasBgVisible={canvasBgVisible} setCanvasBgVisible={setCanvasBgVisible}
            discardChanges={discardChanges}
          />
        </div>
      </div>
    </div>
  );
}
