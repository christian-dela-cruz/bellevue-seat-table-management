// src/features/admin/pages/ReservationDashboard.jsx

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
import Sidebar from "../../../components/layout/Sidebar";
import { fetchReservations, approveReservation, rejectReservation, revertReservation, cancelReservation, updateReservation, getReservationStats } from "../../../utils/api";
import { authAPI } from "../../../services/authAPI";
import { venueAPI } from "../../../services/venueAPI";
import { ADMIN_OUTLET_GROUPS, buildOutletGroupsFromVenues, canonicalOutletName, getScopedOutletGroups, getScopedOutletRooms, buildDynamicOutletTree, resolveOutletChildren } from "../../../constants/outletCatalog";
import RoomFilterDropdown from "../components/RoomFilterDropdown";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || "http://localhost:8000/api";

// ─── Room constants ───────────────────────────────────────────────────────────
const DEFAULT_WING = "Main Wing";

function layoutKey(wing, room) { return `seatmap_layout:${wing}:${room}`; }

function normaliseApiStatus(raw) {
  const s = (raw || "available").toLowerCase();
  if (s === "approved" || s === "reserved") return "reserved";
  if (s === "rejected") return "rejected";
  if (s === "pending")  return "pending";
  return "available";
}

// ─── Design Tokens (light only) ───────────────────────────────────────────────
const C = {
  gold: "#8C6B2A",
  goldLight: "#A07D38",
  goldFaint: "rgba(140,107,42,0.07)",
  goldFaintest: "rgba(140,107,42,0.04)",
  pageBg: "#F7F4EE",
  surfaceBase: "#FFFFFF",
  surfaceInput: "#FFFFFF",
  borderDefault: "rgba(0,0,0,0.08)",
  borderStrong: "rgba(0,0,0,0.13)",
  borderAccent: "rgba(140,107,42,0.28)",
  textPrimary: "#18140E",
  textSecondary: "#7A7060",
  textTertiary: "rgba(24,20,14,0.35)",
  textOnAccent: "#FFFFFF",
  red: "#A03838",
  redFaint: "rgba(160,56,56,0.07)",
  redBorder: "rgba(160,56,56,0.18)",
  green: "#2E7A5A",
  greenFaint: "rgba(46,122,90,0.07)",
  greenBorder: "rgba(46,122,90,0.18)",
  badgePending:  { bg: "rgba(140,107,42,0.09)",  color: "#8C6B2A",  dot: "#8C6B2A"  },
  badgeApproved: { bg: "rgba(46,122,90,0.09)",   color: "#2E7A5A",  dot: "#2E7A5A"  },
  badgeRejected: { bg: "rgba(160,56,56,0.09)",   color: "#A03838",  dot: "#A03838"  },
  navBg: "rgba(247,244,238,0.97)",
  navBorder: "rgba(140,107,42,0.14)",
  divider: "rgba(0,0,0,0.05)",
  inputFocusShadow: "0 0 0 3px rgba(140,107,42,0.10)",
  modalOverlay: "rgba(0,0,0,0.42)",
  statusNote:       { pending: "rgba(140,107,42,0.05)", approved: "rgba(46,122,90,0.05)", rejected: "rgba(160,56,56,0.05)", cancelled: "rgba(160,56,56,0.05)" },
  statusNoteBorder: { pending: "rgba(140,107,42,0.18)", approved: "rgba(46,122,90,0.18)", rejected: "rgba(160,56,56,0.18)", cancelled: "rgba(160,56,56,0.18)" },
  headerGradient: "linear-gradient(160deg,#FAF8F4 0%,#F2EFE8 100%)",
  spinnerBorder: "rgba(0,0,0,0.12)",
  spinnerTop: "#8C6B2A",
  cardBg: "#FFFFFF",
  cardBorder: "rgba(0,0,0,0.07)",
};

const F = {
  display: "'Inter','Helvetica Neue',Arial,sans-serif",
  body:    "'Inter','Helvetica Neue',Arial,sans-serif",
  label:   "'Inter','Helvetica Neue',Arial,sans-serif",
  mono:    "'Inter','Helvetica Neue',Arial,sans-serif",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatTableNumber(tableNumber) {
  if (!tableNumber || tableNumber === "") return "—";
  if (String(tableNumber).toUpperCase() === "STANDALONE") return "Standalone Seat";
  return `Table ${tableNumber}`;
}

function Spinner({ size = 13 }) {
  return (
    <span style={{
      display:"inline-block",width:size,height:size,
      border:`1.5px solid ${C.spinnerBorder}`,
      borderTopColor:C.spinnerTop,
      borderRadius:"50%",animation:"spin 0.65s linear infinite",flexShrink:0,
    }}/>
  );
}

function SectionLabel({ children, style={} }) {
  return (
    <div style={{
      fontFamily:F.label,fontSize:9,letterSpacing:"0.20em",
      color:C.gold,fontWeight:700,textTransform:"uppercase",
      marginBottom:14,paddingBottom:8,
      borderBottom:`1px solid ${C.divider}`,...style,
    }}>
      {children}
    </div>
  );
}

function StatusBadge({ status }) {
  const s=(status||"pending").toLowerCase();
  const map={pending:C.badgePending,approved:C.badgeApproved,reserved:C.badgeApproved,rejected:C.badgeRejected,cancelled:C.badgeRejected};
  const badge=map[s]||C.badgePending;
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:5,
      padding:"3px 10px 3px 7px",
      background:badge.bg,
      border:`1px solid ${badge.color}33`,
      borderRadius:20,
      fontFamily:F.label,fontSize:9,fontWeight:700,
      letterSpacing:"0.12em",textTransform:"uppercase",
      color:badge.color,flexShrink:0,
    }}>
      <span style={{width:5,height:5,borderRadius:"50%",background:badge.dot,flexShrink:0}}/>
      {s.charAt(0).toUpperCase()+s.slice(1)}
    </span>
  );
}

function reservationStateForStatus(status) {
  const s = (status || "").toLowerCase();
  return s === "rejected" || s === "cancelled" ? "inactive" : "active";
}

function getReservationState(reservation) {
  return (reservation?.reservation_state || reservationStateForStatus(reservation?.status)).toLowerCase();
}

function StateBadge({ state }) {
  const s = (state || "active").toLowerCase();
  const active = s === "active";
  const color = active ? C.green : C.textSecondary;
  const bg = active ? C.greenFaint : "rgba(0,0,0,0.05)";
  const border = active ? C.greenBorder : C.borderDefault;

  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:5,
      padding:"3px 9px 3px 7px",
      background:bg,
      border:`1px solid ${border}`,
      borderRadius:20,
      fontFamily:F.label,fontSize:9,fontWeight:700,
      letterSpacing:"0.12em",textTransform:"uppercase",
      color,flexShrink:0,
    }}>
      <span style={{width:5,height:5,borderRadius:"50%",background:color,flexShrink:0}}/>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function parseDateTime(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeTimeValue(value) {
  const raw = String(value || "").trim();
  if (!raw) return "00:00:00";
  const pmMatch = raw.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (pmMatch) {
    let hour = Number(pmMatch[1]);
    const minute = pmMatch[2];
    const meridiem = pmMatch[3].toUpperCase();
    if (meridiem === "PM" && hour < 12) hour += 12;
    if (meridiem === "AM" && hour === 12) hour = 0;
    return `${String(hour).padStart(2, "0")}:${minute}:00`;
  }
  if (/^\d{1,2}:\d{2}$/.test(raw)) return `${raw.padStart(5, "0")}:00`;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(raw)) return raw;
  return "00:00:00";
}

function reservationEventDate(reservation) {
  const datePart = String(reservation?.event_date || "").slice(0, 10);
  if (!datePart) return null;
  return parseDateTime(`${datePart}T${normalizeTimeValue(reservation?.event_time)}`);
}

function reservationSubmittedDate(reservation) {
  if (reservation?.submittedTimestamp) return parseDateTime(Number(reservation.submittedTimestamp) * 1000);
  return parseDateTime(reservation?.submitted_at || reservation?.submittedAt || reservation?.created_at);
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function daysBetween(from, to) {
  return Math.floor((startOfDay(to) - startOfDay(from)) / 86400000);
}

function formatDuration(ms) {
  if (!Number.isFinite(ms)) return "—";
  const minutes = Math.max(0, Math.floor(ms / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ${minutes % 60}m`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function formatTimeUntil(eventAt, now = new Date()) {
  if (!eventAt) return "No schedule";
  const diff = eventAt - now;
  if (diff < -86400000) return `${formatDuration(Math.abs(diff))} past`;
  if (diff < 0) return "Started";
  return formatDuration(diff);
}

function transactionLabel(action) {
  const normalized = String(action || "activity").replace(/_/g, " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function latestTransaction(reservation) {
  const history = Array.isArray(reservation?.transaction_history) ? reservation.transaction_history : [];
  return history[0] || null;
}

function notificationStatus(reservation) {
  const history = Array.isArray(reservation?.transaction_history) ? reservation.transaction_history : [];
  const notification = history.find((item) => String(item?.action || "").startsWith("notification_"));
  if (!notification) return "Not sent";
  if (notification.action === "notification_failed") return "Failed";
  return "Sent";
}

const formatFieldName = (field) => {
  const map = {
    assigned_room_id: "Assigned Room",
    room: "Room",
    internal_room_name: "Internal Room Name",
    public_room_name: "Public Room Name",
    table_number: "Table",
    seat_number: "Seat",
    seat_id: "Seat ID",
    name: "Guest Name",
    email: "Guest Email",
    phone: "Guest Phone",
    guests_count: "Guests",
    event_date: "Event Date",
    event_time: "Event Time",
    event_area: "Event Area",
    setup_tables: "Setup Tables",
    setup_chairs: "Setup Chairs",
    setup_requirements: "Setup Requirements",
    special_requests: "Special Requests",
    type: "Reservation Type",
    is_standalone: "Is Standalone",
    assignment_status: "Assignment Status"
  };
  return map[field] || field.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
};

const formatValue = (field, value) => {
  if (value === null || value === undefined || value === "") return "None";
  if (field === "is_standalone") return value ? "Yes" : "No";
  if (field === "event_date") {
    try {
      return new Date(value + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    } catch {
      return value;
    }
  }
  return String(value);
};

const lastActionSummary = (reservation) => {
  const history = reservation.transaction_history;
  if (!history || !Array.isArray(history) || history.length === 0) {
    return "No activity";
  }
  const lastTx = history[0];
  
  const formatActionName = (action) => {
    const map = {
      approved: "Approved",
      rejected: "Rejected",
      reverted: "Reverted to pending",
      cancelled_by_admin: "Cancelled by admin",
      cancelled_by_guest: "Cancelled by guest",
      room_assigned: "Room assigned",
      room_changed: "Room changed",
      table_seat_changed: "Table/seat changed",
      guest_details_updated: "Guest details updated",
      edited: "Details edited",
      notification_sent: "Notification sent",
      notification_failed: "Notification failed",
      notification_acknowledged: "Notification ack"
    };
    return map[action] || action.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  };

  const getActorLabel = (tx) => {
    if (tx.action === 'cancelled_by_guest') {
      return 'Guest';
    }
    const name = tx.actor_name;
    const role = tx.actor_role;
    if (!name) return 'System';
    return role ? `${name} (${role})` : name;
  };

  const fmtTimeOnly = (value) => {
    if (!value) return "";
    try {
      return new Date(value).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit"
      });
    } catch {
      return "";
    }
  };

  const actionName = formatActionName(lastTx.action);
  const actor = getActorLabel(lastTx);
  const time = fmtTimeOnly(lastTx.created_at);

  return `${actionName} by ${actor}${time ? ` · ${time}` : ""}`;
};

function priorityForReservation(reservation, now = new Date()) {
  const status = String(reservation?.status || "").toLowerCase();
  const eventAt = reservationEventDate(reservation);
  const submittedAt = reservationSubmittedDate(reservation);
  const isPending = status === "pending";
  const isReserved = status === "approved" || status === "reserved";
  const isRejected = status === "rejected";
  const isCancelled = status === "cancelled" || status === "canceled";
  const requestAgeMs = submittedAt ? now - submittedAt : 0;
  const hoursToEvent = eventAt ? (eventAt - now) / 3600000 : Infinity;
  const isUpcomingWindow = eventAt && hoursToEvent >= 0 && hoursToEvent <= 24;
  const isSoonWindow = eventAt && hoursToEvent > 24 && hoursToEvent <= 72;

  if (isPending && requestAgeMs >= 24 * 3600000) {
    return { key: "overdue", label: "Overdue", rank: 0, color: C.red, bg: C.redFaint, border: C.redBorder };
  }
  if (isPending && isUpcomingWindow) {
    return { key: "urgent", label: "Urgent", rank: 1, color: C.red, bg: C.redFaint, border: C.redBorder };
  }
  if (isPending && isSoonWindow) {
    return { key: "soon", label: "Soon", rank: 2, color: C.gold, bg: C.goldFaint, border: C.borderAccent };
  }
  if (isReserved && isUpcomingWindow) {
    return { key: "upcoming", label: "Upcoming", rank: 3, color: C.green, bg: C.greenFaint, border: C.greenBorder };
  }
  if (isRejected) {
    return { key: "closed", label: "Closed", rank: 5, color: C.textSecondary, bg: "rgba(0,0,0,0.035)", border: C.borderDefault };
  }
  if (isCancelled) {
    return { key: "cancelled", label: "Cancelled", rank: 6, color: C.textSecondary, bg: "rgba(0,0,0,0.035)", border: C.borderDefault };
  }
  return { key: "normal", label: "Normal", rank: 4, color: C.green, bg: C.greenFaint, border: C.greenBorder };
}

function enrichReservation(reservation, now = new Date()) {
  const eventAt = reservationEventDate(reservation);
  const submittedAt = reservationSubmittedDate(reservation);
  const latest = latestTransaction(reservation);
  const lastActionAt = parseDateTime(latest?.created_at || latest?.createdAt || reservation?.status_last_changed_at || reservation?.updated_at);
  const priority = priorityForReservation(reservation, now);
  const responseMs = lastActionAt && submittedAt ? lastActionAt - submittedAt : null;

  return {
    ...reservation,
    _eventAt: eventAt,
    _submittedAt: submittedAt,
    _lastAction: latest,
    _lastActionAt: lastActionAt,
    _priority: priority,
    _timeUntil: formatTimeUntil(eventAt, now),
    _requestAge: submittedAt ? formatDuration(now - submittedAt) : "—",
    _responseTime: responseMs ? formatDuration(responseMs) : "—",
    _notificationStatus: notificationStatus(reservation),
    _historyCount: Array.isArray(reservation?.transaction_history) ? reservation.transaction_history.length : 0,
  };
}

function PriorityBadge({ priority }) {
  const badge = priority || priorityForReservation({});
  return (
    <span style={{
      display:"inline-flex",alignItems:"center",gap:5,
      padding:"3px 9px",
      borderRadius:20,
      background:badge.bg,
      border:`1px solid ${badge.border}`,
      color:badge.color,
      fontFamily:F.label,
      fontSize:9,
      fontWeight:800,
      letterSpacing:"0.11em",
      textTransform:"uppercase",
      whiteSpace:"nowrap",
    }}>
      <span style={{width:5,height:5,borderRadius:"50%",background:badge.color}}/>
      {badge.label}
    </span>
  );
}

function OperationalMetricCard({ label, value, helper, tone = "gold", onClick }) {
  const color = tone === "red" ? C.red : tone === "green" ? C.green : C.gold;
  const bg = tone === "red" ? C.redFaint : tone === "green" ? C.greenFaint : C.goldFaint;
  const border = tone === "red" ? C.redBorder : tone === "green" ? C.greenBorder : C.borderAccent;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        minHeight:78,
        textAlign:"left",
        border:`1px solid ${border}`,
        borderRadius:10,
        background:`linear-gradient(180deg, ${C.surfaceBase} 0%, ${bg} 100%)`,
        padding:"13px 15px",
        cursor:onClick ? "pointer" : "default",
        display:"grid",
        gap:5,
        boxShadow:"0 1px 4px rgba(0,0,0,0.045)",
      }}
    >
      <span style={{fontFamily:F.label,fontSize:8.5,fontWeight:800,letterSpacing:"0.15em",textTransform:"uppercase",color:C.textTertiary}}>{label}</span>
      <span style={{fontFamily:F.display,fontSize:25,fontWeight:760,lineHeight:1,color}}>{value}</span>
      <span style={{fontSize:11.5,color:C.textSecondary,lineHeight:1.35}}>{helper}</span>
    </button>
  );
}

function queueTone(tone) {
  if (tone === "red") return { color: C.red, bg: C.redFaint, border: C.redBorder };
  if (tone === "green") return { color: C.green, bg: C.greenFaint, border: C.greenBorder };
  if (tone === "muted") return { color: C.textSecondary, bg: "rgba(0,0,0,0.035)", border: C.borderDefault };
  return { color: C.gold, bg: C.goldFaint, border: C.borderAccent };
}

function QueueMetric({ label, value, helper, tone = "gold", active = false, onClick, isMobile }) {
  const palette = queueTone(tone);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border:`1px solid ${active ? palette.border : C.cardBorder}`,
        borderRadius:10,
        background:active ? palette.bg : C.surfaceBase,
        padding:isMobile ? "10px 11px" : "12px 14px",
        minHeight:isMobile ? 68 : 76,
        display:"grid",
        alignContent:"center",
        gap:5,
        textAlign:"left",
        cursor:onClick ? "pointer" : "default",
        boxShadow:active ? `0 1px 5px ${palette.color}10` : "0 1px 3px rgba(24,20,14,0.025)",
        transition:"border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease, background 0.18s ease",
      }}
      onMouseEnter={(e)=>{e.currentTarget.style.borderColor=palette.border;e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=`0 2px 7px ${palette.color}10`;}}
      onMouseLeave={(e)=>{e.currentTarget.style.borderColor=active ? palette.border : C.cardBorder;e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow=active ? `0 1px 5px ${palette.color}10` : "0 1px 3px rgba(24,20,14,0.025)";}}
    >
      <span style={{fontFamily:F.label,fontSize:8.5,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:active ? palette.color : C.textTertiary}}>
        {label}
      </span>
      <span style={{display:"flex",alignItems:"baseline",gap:8}}>
        <span style={{fontFamily:F.display,fontSize:isMobile?24:28,fontWeight:760,lineHeight:1,color:palette.color}}>
          {value}
        </span>
        <span style={{fontSize:11.5,color:C.textSecondary,lineHeight:1.25,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
          {helper}
        </span>
      </span>
    </button>
  );
}

function InlineMetric({ label, value, tone = "gold" }) {
  const palette = queueTone(tone);
  return (
    <span style={{
      display:"inline-flex",
      alignItems:"center",
      gap:6,
      padding:"5px 9px",
      borderRadius:999,
      background:palette.bg,
      border:`1px solid ${palette.border}`,
      color:palette.color,
      fontFamily:F.label,
      fontSize:9,
      fontWeight:800,
      letterSpacing:"0.10em",
      textTransform:"uppercase",
      whiteSpace:"nowrap",
    }}>
      <span style={{color:palette.color,fontSize:11,fontWeight:800,letterSpacing:0}}>{value}</span>
      {label}
    </span>
  );
}

function getSeatStatusColor(status) {
  const s = (status || "").toLowerCase();
  if (s === "approved" || s === "reserved") return C.red;
  if (s === "rejected" || s === "cancelled") return C.green;
  if (s === "pending") return C.gold;
  return C.textTertiary;
}

function getSeatStatusWeight(status) {
  const s = (status || "").toLowerCase();
  return ["approved", "reserved", "rejected", "cancelled", "pending"].includes(s) ? 700 : 400;
}

/*
  try {
    const wing = String(reservation.wing ?? DEFAULT_WING).trim();
    const room = String(reservation.room ?? "").trim();

    if (!room) {
      console.warn("[Dashboard] optimisticSeatUpdate: no room field", reservation);
      return;
    }

    const key = layoutKey(wing, room);
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const layout = JSON.parse(raw);
    if (!layout) return;

    const isStandalone =
      String(reservation.table_number || "").toUpperCase() === "STANDALONE" ||
      reservation.type === "standalone" ||
      reservation.is_standalone === 1 ||
      reservation.is_standalone === true;

    const rawSeatField = String(reservation.seat ?? reservation.seat_number ?? "").trim();
    const seatNums = new Set(
      rawSeatField.split(",").map(s => s.trim()).filter(Boolean)
    );
    const guestsCount = parseInt(reservation.guests_count ?? reservation.guests ?? 0, 10);
    const reservationType = String(reservation.type ?? "").toLowerCase();

    const persist = (updated) => {
      const payload = JSON.stringify(updated);
      localStorage.setItem(key, payload);
      window.dispatchEvent(new StorageEvent("storage", {
        key, newValue: payload, storageArea: localStorage,
      }));
      window.dispatchEvent(new CustomEvent("seatmap:saved", {
        detail: { wing, room, payload },
      }));
    };

    if (isStandalone) {
      const updatedStandaloneSeats = (layout.standaloneSeats || []).map(s => {
        const num = String(s.num ?? s.label ?? s.id ?? "").trim();
        if (seatNums.has(num) || seatNums.has(String(s.id).trim())) {
          return { ...s, status: newSeatStatus };
        }
        return s;
      });
      persist({ ...layout, standaloneSeats: updatedStandaloneSeats });
      return;
    }

    const tableId = String(reservation.table_number ?? "").trim();

    const updatedTables = (layout.tables || []).map(t => {
      const tId = String(t.id ?? "").trim();
      const tLabel = String(t.label ?? "").trim();
      const normalizedTableId = tableId.replace(/^T/i, "");
      const normalizedTId = tId.replace(/^T/i, "");
      const normalizedTLabel = tLabel.replace(/^T/i, "");

      const tableMatches =
        tId === tableId ||
        tLabel === tableId ||
        normalizedTId === normalizedTableId ||
        normalizedTLabel === normalizedTableId;

      if (!tableMatches) return t;

      const isWholeTable = reservationType === "whole" || seatNums.size > 1;

      if (isWholeTable) {
        if (seatNums.size > 0) {
          return {
            ...t,
            seats: t.seats.map(s => {
              const num = String(s.num ?? s.label ?? s.id ?? "").trim();
              return seatNums.has(num) ? { ...s, status: newSeatStatus } : s;
            }),
          };
        } else {
          let marked = 0;
          return {
            ...t,
            seats: t.seats.map(s => {
              if (marked < guestsCount && (s.status === "available" || s.status === "pending")) {
                marked++;
  const s = (status || "").toLowerCase();
  if (s === "approved" || s === "reserved") return C.red;
  if (s === "rejected" || s === "cancelled") return C.green;
  if (s === "pending") return C.gold;
  return C.textTertiary;
}




*/

function optimisticSeatUpdate(reservation, newSeatStatus) {
  try {
    const wing = String(reservation.wing ?? DEFAULT_WING).trim();
    const room = String(reservation.room ?? "").trim();

    if (!room) {
      console.warn("[Dashboard] optimisticSeatUpdate: no room field", reservation);
      return;
    }

    const key = layoutKey(wing, room);
    const raw = localStorage.getItem(key);
    if (!raw) return;
    const layout = JSON.parse(raw);
    if (!layout) return;

    const isStandalone =
      String(reservation.table_number || "").toUpperCase() === "STANDALONE" ||
      reservation.type === "standalone" ||
      reservation.is_standalone === 1 ||
      reservation.is_standalone === true;

    const rawSeatField = String(reservation.seat ?? reservation.seat_number ?? "").trim();
    const seatNums = new Set(
      rawSeatField.split(",").map(s => s.trim()).filter(Boolean)
    );
    const guestsCount = parseInt(reservation.guests_count ?? reservation.guests ?? 0, 10);
    const reservationType = String(reservation.type ?? "").toLowerCase();

    const persist = (updated) => {
      const payload = JSON.stringify(updated);
      localStorage.setItem(key, payload);
      window.dispatchEvent(new StorageEvent("storage", {
        key, newValue: payload, storageArea: localStorage,
      }));
      window.dispatchEvent(new CustomEvent("seatmap:saved", {
        detail: { wing, room, payload },
      }));
    };

    if (isStandalone) {
      const updatedStandaloneSeats = (layout.standaloneSeats || []).map(s => {
        const num = String(s.num ?? s.label ?? s.id ?? "").trim();
        if (seatNums.has(num) || seatNums.has(String(s.id).trim())) {
          return { ...s, status: newSeatStatus };
        }
        return s;
      });
      persist({ ...layout, standaloneSeats: updatedStandaloneSeats });
      return;
    }

    const tableId = String(reservation.table_number ?? "").trim();

    const updatedTables = (layout.tables || []).map(t => {
      const tId = String(t.id ?? "").trim();
      const tLabel = String(t.label ?? "").trim();
      const normalizedTableId = tableId.replace(/^T/i, "");
      const normalizedTId = tId.replace(/^T/i, "");
      const normalizedTLabel = tLabel.replace(/^T/i, "");

      const tableMatches =
        tId === tableId ||
        tLabel === tableId ||
        normalizedTId === normalizedTableId ||
        normalizedTLabel === normalizedTableId;

      if (!tableMatches) return t;

      const isWholeTable = reservationType === "whole" || seatNums.size > 1;

      if (isWholeTable) {
        if (seatNums.size > 0) {
          return {
            ...t,
            seats: t.seats.map(s => {
              const num = String(s.num ?? s.label ?? s.id ?? "").trim();
              return seatNums.has(num) ? { ...s, status: newSeatStatus } : s;
            }),
          };
        } else {
          let marked = 0;
          return {
            ...t,
            seats: t.seats.map(s => {
              if (marked < guestsCount && (s.status === "available" || s.status === "pending")) {
                marked++;
                return { ...s, status: newSeatStatus };
              }
              return s;
            }),
          };
        }
      }
      return {
        ...t,
        seats: t.seats.map(s => {
          const num = String(s.num ?? s.label ?? s.id ?? "").trim();
          return seatNums.has(num) ? { ...s, status: newSeatStatus } : s;
        }),
      };
    });

    persist({ ...layout, tables: updatedTables });
  } catch (err) {
    console.warn("[Dashboard] optimisticSeatUpdate error:", err);
  }
}

// ─── Reject Reason Modal ──────────────────────────────────────────────────────
function RejectReasonModal({ reservation, onConfirm, onCancel, loading }) {
  const [reason,setReason]=useState("");
  const [focused,setFocused]=useState(false);
  const [showConfirmation,setShowConfirmation]=useState(false);
  const MIN_REASON_LENGTH = 5;
  const trimmedReason = reason.trim();
  const canReview=trimmedReason.length>=MIN_REASON_LENGTH&&!loading;

  if (showConfirmation) {
    return (
      <div
        style={{
          position:"fixed",inset:0,
          background:"rgba(0,0,0,0.60)",
          zIndex:5100,
          display:"flex",alignItems:"center",justifyContent:"center",
          padding:20,
          backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",
        }}
        onClick={(e)=>{if(e.target===e.currentTarget&&!loading)setShowConfirmation(false);}}
      >
        <div style={{
          background:C.surfaceBase,borderRadius:14,
          width:"100%",maxWidth:440,
          boxShadow:"0 20px 60px rgba(0,0,0,0.20)",
          border:`1px solid ${C.borderDefault}`,
          fontFamily:F.body,
          animation:"modalIn 0.20s cubic-bezier(0.16,1,0.3,1)",
          overflow:"hidden",
        }}>
          <div style={{height:2,background:`linear-gradient(90deg,transparent 0%,${C.red}90 30%,${C.red}90 70%,transparent 100%)`}}/>

          <div style={{
            background:C.headerGradient,
            padding:"18px 22px 16px",
            borderBottom:`1px solid ${C.divider}`,
          }}>
            <div style={{fontFamily:F.label,fontSize:9,letterSpacing:"0.22em",color:C.red,fontWeight:700,textTransform:"uppercase",marginBottom:5,opacity:0.85}}>
              Confirm Rejection
            </div>
            <div style={{fontFamily:F.display,fontSize:17,fontWeight:600,color:C.textPrimary,lineHeight:1.2}}>
              {reservation.name||"Reservation"}
            </div>
          </div>

          <div style={{padding:"20px 22px 24px"}}>
            <div style={{
              padding:"10px 14px",borderRadius:8,marginBottom:14,
              background:C.statusNote.rejected,border:`1px solid ${C.statusNoteBorder.rejected}`,
              fontFamily:F.body,fontSize:12,color:C.textSecondary,lineHeight:1.65,
            }}>
              This will mark the reservation as rejected, move it to inactive, release the selected seat/table, and send the rejection reason to the guest.
            </div>

            <div style={{fontFamily:F.label,fontSize:9,letterSpacing:"0.18em",color:C.textSecondary,fontWeight:700,textTransform:"uppercase",marginBottom:7}}>
              Reason to Send
            </div>
            <div style={{
              padding:"11px 13px",
              border:`1px solid ${C.borderDefault}`,
              borderRadius:8,
              background:"rgba(0,0,0,0.02)",
              fontFamily:F.body,
              fontSize:12,
              color:C.textPrimary,
              lineHeight:1.6,
              whiteSpace:"pre-wrap",
              maxHeight:120,
              overflowY:"auto",
            }}>
              {trimmedReason}
            </div>

            <div style={{display:"flex",gap:8,marginTop:16}}>
              <button
                onClick={()=>setShowConfirmation(false)}
                disabled={loading}
                style={{
                  flex:1,padding:"11px",
                  background:"transparent",border:`1px solid ${C.borderDefault}`,
                  borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,
                  letterSpacing:"0.14em",textTransform:"uppercase",
                  color:C.textSecondary,cursor:loading?"not-allowed":"pointer",transition:"all 0.18s",
                }}
                onMouseEnter={(e)=>{if(!loading){e.currentTarget.style.borderColor=C.borderAccent;e.currentTarget.style.color=C.gold;}}}
                onMouseLeave={(e)=>{e.currentTarget.style.borderColor=C.borderDefault;e.currentTarget.style.color=C.textSecondary;}}
              >
                Back
              </button>
              <button
                onClick={()=>!loading&&onConfirm(trimmedReason)}
                disabled={loading}
                style={{
                  flex:2,padding:"11px",
                  background:loading?"rgba(160,56,56,0.35)":C.red,
                  border:"none",borderRadius:8,
                  fontFamily:F.label,fontSize:10,fontWeight:700,
                  letterSpacing:"0.14em",textTransform:"uppercase",
                  color:"#fff",cursor:loading?"not-allowed":"pointer",
                  transition:"all 0.18s",
                  display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                }}
                onMouseEnter={(e)=>{if(!loading)e.currentTarget.style.background="#8a2e2e";}}
                onMouseLeave={(e)=>{if(!loading)e.currentTarget.style.background=C.red;}}
              >
                {loading?<><Spinner/>Rejecting...</>:"Confirm Reject"}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        position:"fixed",inset:0,
        background:"rgba(0,0,0,0.55)",
        zIndex:5000,
        display:"flex",alignItems:"center",justifyContent:"center",
        padding:20,
        backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",
      }}
      onClick={(e)=>{if(e.target===e.currentTarget&&!loading)onCancel();}}
    >
      <div style={{
        background:C.surfaceBase,borderRadius:14,
        width:"100%",maxWidth:440,
        boxShadow:"0 20px 60px rgba(0,0,0,0.18)",
        border:`1px solid ${C.borderDefault}`,
        fontFamily:F.body,
        animation:"modalIn 0.20s cubic-bezier(0.16,1,0.3,1)",
        overflow:"hidden",
      }}>
        <div style={{height:2,background:`linear-gradient(90deg,transparent 0%,${C.red}90 30%,${C.red}90 70%,transparent 100%)`}}/>

        <div style={{
          background:C.headerGradient,
          padding:"18px 22px 16px",
          borderBottom:`1px solid ${C.divider}`,
          display:"flex",alignItems:"flex-start",justifyContent:"space-between",
        }}>
          <div>
            <div style={{fontFamily:F.label,fontSize:9,letterSpacing:"0.22em",color:C.red,fontWeight:700,textTransform:"uppercase",marginBottom:5,opacity:0.85}}>
              Reject Reservation
            </div>
            <div style={{fontFamily:F.display,fontSize:17,fontWeight:600,color:C.textPrimary,lineHeight:1.2}}>
              {reservation.name||"—"}
            </div>
          </div>
          <button onClick={onCancel} disabled={loading}
            style={{
              width:30,height:30,borderRadius:"50%",background:"transparent",
              border:`1px solid ${C.borderDefault}`,cursor:loading?"not-allowed":"pointer",
              display:"flex",alignItems:"center",justifyContent:"center",
              flexShrink:0,transition:"border-color 0.18s",padding:0,
            }}
            onMouseEnter={(e)=>{if(!loading)e.currentTarget.style.borderColor=C.red;}}
            onMouseLeave={(e)=>{e.currentTarget.style.borderColor=C.borderDefault;}}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke={C.textSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <div style={{padding:"20px 22px 24px"}}>
          <div style={{
            padding:"10px 14px",borderRadius:8,marginBottom:18,
            background:C.statusNote.rejected,border:`1px solid ${C.statusNoteBorder.rejected}`,
            fontFamily:F.body,fontSize:12,color:C.textSecondary,lineHeight:1.65,
          }}>
            A rejection email will be sent to{" "}
            <strong style={{color:C.textPrimary}}>{reservation.email}</strong>{" "}
            after you review and confirm the rejection.
          </div>

          <label style={{
            display:"block",fontFamily:F.label,fontSize:9,letterSpacing:"0.18em",
            color:focused?C.gold:C.textSecondary,fontWeight:700,
            textTransform:"uppercase",marginBottom:7,transition:"color 0.18s",
          }}>
            Reason for Rejection <span style={{color:C.red,marginLeft:3}}>*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e)=>setReason(e.target.value)}
            onFocus={()=>setFocused(true)}
            onBlur={()=>setFocused(false)}
            placeholder="e.g. Venue fully booked for the requested date, capacity exceeded…"
            rows={4}
            style={{
              width:"100%",boxSizing:"border-box",
              padding:"11px 14px",
              border:`1.5px solid ${focused?C.borderAccent:C.borderDefault}`,
              borderRadius:8,background:C.surfaceInput,
              fontFamily:F.body,fontSize:13,color:C.textPrimary,
              outline:"none",transition:"border-color 0.18s,box-shadow 0.18s",
              boxShadow:focused?C.inputFocusShadow:"none",
              resize:"vertical",minHeight:90,
            }}
          />
          {trimmedReason.length > 0 && trimmedReason.length < MIN_REASON_LENGTH && (
            <div style={{fontFamily:F.body,fontSize:11,color:C.red,marginTop:7}}>
              Reason must be at least {MIN_REASON_LENGTH} characters.
            </div>
          )}

          <div style={{display:"flex",gap:8,marginTop:16}}>
            <button onClick={onCancel} disabled={loading}
              style={{
                flex:1,padding:"11px",
                background:"transparent",border:`1px solid ${C.borderDefault}`,
                borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,
                letterSpacing:"0.14em",textTransform:"uppercase",
                color:C.textSecondary,cursor:loading?"not-allowed":"pointer",transition:"all 0.18s",
              }}
              onMouseEnter={(e)=>{if(!loading){e.currentTarget.style.borderColor=C.borderAccent;e.currentTarget.style.color=C.gold;}}}
              onMouseLeave={(e)=>{e.currentTarget.style.borderColor=C.borderDefault;e.currentTarget.style.color=C.textSecondary;}}
            >Cancel</button>
            <button
              onClick={()=>canReview&&setShowConfirmation(true)}
              disabled={!canReview}
              style={{
                flex:2,padding:"11px",
                background:canReview?C.red:"rgba(160,56,56,0.35)",
                border:"none",borderRadius:8,
                fontFamily:F.label,fontSize:10,fontWeight:700,
                letterSpacing:"0.14em",textTransform:"uppercase",
                color:"#fff",cursor:canReview?"pointer":"not-allowed",
                transition:"all 0.18s",
                display:"flex",alignItems:"center",justifyContent:"center",gap:7,
              }}
              onMouseEnter={(e)=>{if(canReview)e.currentTarget.style.background="#8a2e2e";}}
              onMouseLeave={(e)=>{if(canReview)e.currentTarget.style.background=C.red;}}
            >
              Review Rejection
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RevertConfirmModal({ reservation, onConfirm, onCancel, loading }) {
  return (
    <div
      style={{
        position:"fixed",inset:0,
        background:"rgba(0,0,0,0.60)",
        zIndex:5100,
        display:"flex",alignItems:"center",justifyContent:"center",
        padding:20,
        backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",
      }}
      onClick={(e)=>{if(e.target===e.currentTarget&&!loading)onCancel();}}
    >
      <div style={{
        background:C.surfaceBase,borderRadius:14,
        width:"100%",maxWidth:440,
        boxShadow:"0 20px 60px rgba(0,0,0,0.20)",
        border:`1px solid ${C.borderDefault}`,
        fontFamily:F.body,
        animation:"modalIn 0.20s cubic-bezier(0.16,1,0.3,1)",
        overflow:"hidden",
      }}>
        <div style={{height:2,background:`linear-gradient(90deg,transparent 0%,${C.gold}90 30%,${C.gold}90 70%,transparent 100%)`}}/>

        <div style={{
          background:C.headerGradient,
          padding:"18px 22px 16px",
          borderBottom:`1px solid ${C.divider}`,
        }}>
          <div style={{fontFamily:F.label,fontSize:9,letterSpacing:"0.22em",color:C.gold,fontWeight:700,textTransform:"uppercase",marginBottom:5,opacity:0.85}}>
            Confirm Revert
          </div>
          <div style={{fontFamily:F.display,fontSize:17,fontWeight:600,color:C.textPrimary,lineHeight:1.2}}>
            {reservation.name||"Reservation"}
          </div>
        </div>

        <div style={{padding:"20px 22px 24px"}}>
          <div style={{
            padding:"10px 14px",borderRadius:8,marginBottom:14,
            background:C.goldFaint,border:`1px solid ${C.borderAccent}`,
            fontFamily:F.body,fontSize:12,color:C.textSecondary,lineHeight:1.65,
          }}>
            This will move the rejected reservation back to pending review, mark it active again, and keep the previous rejection reason for history.
          </div>

          <div style={{display:"grid",gap:8,marginBottom:16}}>
            {[
              ["Current Status", "Rejected"],
              ["New Status", "Pending"],
              ["Reference", reservation.reference_code||reservation.id||"—"],
            ].map(([label,value])=>(
              <div key={label} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"8px 0",borderBottom:`1px solid ${C.divider}`}}>
                <span style={{fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>{label}</span>
                <span style={{fontFamily:F.body,fontSize:12.5,fontWeight:600,color:C.textPrimary,textAlign:"right"}}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{display:"flex",gap:8}}>
            <button
              onClick={onCancel}
              disabled={loading}
              style={{
                flex:1,padding:"11px",
                background:"transparent",border:`1px solid ${C.borderDefault}`,
                borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,
                letterSpacing:"0.14em",textTransform:"uppercase",
                color:C.textSecondary,cursor:loading?"not-allowed":"pointer",transition:"all 0.18s",
              }}
              onMouseEnter={(e)=>{if(!loading){e.currentTarget.style.borderColor=C.borderAccent;e.currentTarget.style.color=C.textPrimary;}}}
              onMouseLeave={(e)=>{e.currentTarget.style.borderColor=C.borderDefault;e.currentTarget.style.color=C.textSecondary;}}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              style={{
                flex:2,padding:"11px",
                background:loading?"rgba(140,107,42,0.45)":C.gold,
                border:"none",borderRadius:8,
                fontFamily:F.label,fontSize:10,fontWeight:700,
                letterSpacing:"0.14em",textTransform:"uppercase",
                color:"#fff",cursor:loading?"not-allowed":"pointer",
                transition:"all 0.18s",
                display:"flex",alignItems:"center",justifyContent:"center",gap:7,
              }}
              onMouseEnter={(e)=>{if(!loading)e.currentTarget.style.background=C.goldLight;}}
              onMouseLeave={(e)=>{if(!loading)e.currentTarget.style.background=C.gold;}}
            >
              {loading?<><Spinner/>Reverting...</>:"Confirm Revert"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApproveConfirmModal({ reservation, onConfirm, onCancel, loading }) {
  return (
    <div
      style={{
        position:"fixed",inset:0,
        background:"rgba(0,0,0,0.60)",
        zIndex:5100,
        display:"flex",alignItems:"center",justifyContent:"center",
        padding:20,
        backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",
      }}
      onClick={(e)=>{if(e.target===e.currentTarget&&!loading)onCancel();}}
    >
      <div style={{
        background:C.surfaceBase,borderRadius:14,
        width:"100%",maxWidth:440,
        boxShadow:"0 20px 60px rgba(0,0,0,0.20)",
        border:`1px solid ${C.borderDefault}`,
        fontFamily:F.body,
        animation:"modalIn 0.20s cubic-bezier(0.16,1,0.3,1)",
        overflow:"hidden",
      }}>
        <div style={{height:2,background:`linear-gradient(90deg,transparent 0%,${C.green}90 30%,${C.green}90 70%,transparent 100%)`}}/>

        <div style={{background:C.headerGradient,padding:"18px 22px 16px",borderBottom:`1px solid ${C.divider}`}}>
          <div style={{fontFamily:F.label,fontSize:9,letterSpacing:"0.22em",color:C.green,fontWeight:700,textTransform:"uppercase",marginBottom:5,opacity:0.85}}>
            Confirm Approval
          </div>
          <div style={{fontFamily:F.display,fontSize:17,fontWeight:600,color:C.textPrimary,lineHeight:1.2}}>
            {reservation.name||"Reservation"}
          </div>
        </div>

        <div style={{padding:"20px 22px 24px"}}>
          <div style={{
            padding:"10px 14px",borderRadius:8,marginBottom:14,
            background:C.greenFaint,border:`1px solid ${C.greenBorder}`,
            fontFamily:F.body,fontSize:12,color:C.textSecondary,lineHeight:1.65,
          }}>
            This will approve the reservation, reserve the selected seat/table, and send a confirmation email to the guest. This cannot be undone from this action.
          </div>

          <div style={{display:"grid",gap:8,marginBottom:16}}>
            {[
              ["Current Status", "Pending"],
              ["New Status", "Reserved"],
              ["Reference", reservation.reference_code||reservation.id||"-"],
            ].map(([label,value])=>(
              <div key={label} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"8px 0",borderBottom:`1px solid ${C.divider}`}}>
                <span style={{fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>{label}</span>
                <span style={{fontFamily:F.body,fontSize:12.5,fontWeight:600,color:C.textPrimary,textAlign:"right"}}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{display:"flex",gap:8}}>
            <button onClick={onCancel} disabled={loading} style={{flex:1,padding:"11px",background:"transparent",border:`1px solid ${C.borderDefault}`,borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textSecondary,cursor:loading?"not-allowed":"pointer"}}>
              Cancel
            </button>
            <button onClick={onConfirm} disabled={loading} style={{flex:2,padding:"11px",background:loading?"rgba(46,122,90,0.45)":C.green,border:"none",borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"#fff",cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
              {loading?<><Spinner/>Approving...</>:"Confirm Approval"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────
function EditField({ label, children }) {
  return (
    <label style={{display:"block"}}>
      <span style={{
        display:"block",fontFamily:F.label,fontSize:9,fontWeight:700,
        letterSpacing:"0.16em",textTransform:"uppercase",color:C.textTertiary,
        marginBottom:7,
      }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function editInputStyle(focused = false) {
  return {
    width:"100%",
    padding:"10px 12px",
    border:`1.5px solid ${focused ? C.borderAccent : C.borderDefault}`,
    borderRadius:8,
    background:C.surfaceInput,
    fontFamily:F.body,
    fontSize:13,
    color:C.textPrimary,
    outline:"none",
    boxShadow:focused ? C.inputFocusShadow : "none",
  };
}

function ReservationEditForm({ form, setForm, disabled, hasChildren, availableSubrooms, loadingSubrooms }) {
  const [focused,setFocused]=useState(null);
  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  return (
    <div style={{display:"grid",gridTemplateColumns:"repeat(2,minmax(0,1fr))",gap:12}}>
      <EditField label="Full Name">
        <input disabled={disabled} value={form.name} onChange={(e)=>update("name",e.target.value)} onFocus={()=>setFocused("name")} onBlur={()=>setFocused(null)} style={editInputStyle(focused==="name")}/>
      </EditField>
      <EditField label="Email">
        <input disabled={disabled} type="email" value={form.email} onChange={(e)=>update("email",e.target.value)} onFocus={()=>setFocused("email")} onBlur={()=>setFocused(null)} style={editInputStyle(focused==="email")}/>
      </EditField>
      <EditField label="Phone">
        <input disabled={disabled} value={form.phone} onChange={(e)=>update("phone",e.target.value)} onFocus={()=>setFocused("phone")} onBlur={()=>setFocused(null)} style={editInputStyle(focused==="phone")}/>
      </EditField>
      <EditField label="Guests">
        <input disabled={disabled} type="number" min="1" value={form.guests_count} onChange={(e)=>update("guests_count",e.target.value)} onFocus={()=>setFocused("guests_count")} onBlur={()=>setFocused(null)} style={editInputStyle(focused==="guests_count")}/>
      </EditField>
      <EditField label="Event Date">
        <input disabled={disabled} type="date" value={form.event_date} onChange={(e)=>update("event_date",e.target.value)} onFocus={()=>setFocused("event_date")} onBlur={()=>setFocused(null)} style={editInputStyle(focused==="event_date")}/>
      </EditField>
      <EditField label="Event Time">
        <input disabled={disabled} type="time" value={form.event_time} onChange={(e)=>update("event_time",e.target.value)} onFocus={()=>setFocused("event_time")} onBlur={()=>setFocused(null)} style={editInputStyle(focused==="event_time")}/>
      </EditField>
      <EditField label="Room">
        <input disabled={disabled} value={form.room} onChange={(e)=>update("room",e.target.value)} onFocus={()=>setFocused("room")} onBlur={()=>setFocused(null)} style={editInputStyle(focused==="room")}/>
      </EditField>
      {hasChildren && (
        <EditField label="Assigned Subroom">
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <select
              disabled={disabled || loadingSubrooms}
              value={form.assigned_room_id || ""}
              onChange={(e) => update("assigned_room_id", e.target.value ? Number(e.target.value) : "")}
              style={editInputStyle(focused === "assigned_room_id")}
              onFocus={() => setFocused("assigned_room_id")}
              onBlur={() => setFocused(null)}
            >
              <option value="">-- Needs Room Assignment (Pending) --</option>
              {availableSubrooms.map(sub => (
                <option key={sub.id} value={sub.id}>
                  {sub.display_name || sub.name} (Cap: {sub.capacity || "N/A"})
                </option>
              ))}
            </select>
            {loadingSubrooms && <Spinner />}
          </div>
        </EditField>
      )}
      <EditField label="Type">
        <select disabled={disabled} value={form.type} onChange={(e)=>update("type",e.target.value)} onFocus={()=>setFocused("type")} onBlur={()=>setFocused(null)} style={editInputStyle(focused==="type")}>
          <option value="whole">Whole Table</option>
          <option value="individual">Individual Seat</option>
          <option value="standalone">Standalone Seat</option>
        </select>
      </EditField>
      <EditField label="Table">
        <input disabled={disabled || form.type === "standalone"} value={form.type === "standalone" ? "STANDALONE" : form.table_number} onChange={(e)=>update("table_number",e.target.value)} onFocus={()=>setFocused("table_number")} onBlur={()=>setFocused(null)} style={editInputStyle(focused==="table_number")}/>
      </EditField>
      <EditField label="Seat">
        <input disabled={disabled} value={form.seat_number} onChange={(e)=>update("seat_number",e.target.value)} onFocus={()=>setFocused("seat_number")} onBlur={()=>setFocused(null)} style={editInputStyle(focused==="seat_number")}/>
      </EditField>
      <div style={{gridColumn:"1 / -1"}}>
        <EditField label="Special Requests">
          <textarea disabled={disabled} rows={3} value={form.special_requests} onChange={(e)=>update("special_requests",e.target.value)} onFocus={()=>setFocused("special_requests")} onBlur={()=>setFocused(null)} style={{...editInputStyle(focused==="special_requests"),resize:"vertical",minHeight:78}}/>
        </EditField>
      </div>
    </div>
  );
}

function SaveChangesConfirmModal({ reservation, changes, onConfirm, onCancel, loading }) {
  return (
    <div
      style={{
        position:"fixed",inset:0,
        background:"rgba(0,0,0,0.60)",
        zIndex:5100,
        display:"flex",alignItems:"center",justifyContent:"center",
        padding:20,
        backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",
      }}
      onClick={(e)=>{if(e.target===e.currentTarget&&!loading)onCancel();}}
    >
      <div style={{
        background:C.surfaceBase,borderRadius:14,
        width:"100%",maxWidth:460,
        boxShadow:"0 20px 60px rgba(0,0,0,0.20)",
        border:`1px solid ${C.borderDefault}`,
        fontFamily:F.body,
        animation:"modalIn 0.20s cubic-bezier(0.16,1,0.3,1)",
        overflow:"hidden",
      }}>
        <div style={{height:2,background:`linear-gradient(90deg,transparent 0%,${C.gold}90 30%,${C.gold}90 70%,transparent 100%)`}}/>
        <div style={{background:C.headerGradient,padding:"18px 22px 16px",borderBottom:`1px solid ${C.divider}`}}>
          <div style={{fontFamily:F.label,fontSize:9,letterSpacing:"0.22em",color:C.gold,fontWeight:700,textTransform:"uppercase",marginBottom:5,opacity:0.85}}>
            Confirm Detail Update
          </div>
          <div style={{fontFamily:F.display,fontSize:17,fontWeight:600,color:C.textPrimary,lineHeight:1.2}}>
            {reservation.name||"Reservation"}
          </div>
        </div>
        <div style={{padding:"20px 22px 24px"}}>
          <div style={{padding:"10px 14px",borderRadius:8,marginBottom:14,background:C.goldFaint,border:`1px solid ${C.borderAccent}`,fontFamily:F.body,fontSize:12,color:C.textSecondary,lineHeight:1.65}}>
            This will update the reservation details and record the modification in reservation history. It will not send a guest email.
          </div>
          <div style={{display:"grid",gap:8,maxHeight:180,overflowY:"auto",marginBottom:16}}>
            {changes.map(([label,value])=>(
              <div key={label} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"8px 0",borderBottom:`1px solid ${C.divider}`}}>
                <span style={{fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>{label}</span>
                <span style={{fontFamily:F.body,fontSize:12.5,fontWeight:600,color:C.textPrimary,textAlign:"right",lineHeight:1.4}}>{value}</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onCancel} disabled={loading} style={{flex:1,padding:"11px",background:"transparent",border:`1px solid ${C.borderDefault}`,borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textSecondary,cursor:loading?"not-allowed":"pointer"}}>
              Cancel
            </button>
            <button onClick={onConfirm} disabled={loading} style={{flex:2,padding:"11px",background:loading?"rgba(140,107,42,0.45)":C.gold,border:"none",borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"#fff",cursor:loading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}>
              {loading?<><Spinner/>Saving...</>:"Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CancelConfirmModal({ reservation, onConfirm, onCancel, loading }) {
  const [reason, setReason] = useState("");
  const [focused, setFocused] = useState(false);
  const isValid = reason.trim().length >= 3;
  return (
    <div
      style={{
        position:"fixed",inset:0,
        background:"rgba(0,0,0,0.60)",
        zIndex:5100,
        display:"flex",alignItems:"center",justifyContent:"center",
        padding:20,
        backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",
      }}
      onClick={(e)=>{if(e.target===e.currentTarget&&!loading)onCancel();}}
    >
      <div style={{
        background:C.surfaceBase,borderRadius:14,
        width:"100%",maxWidth:460,
        boxShadow:"0 20px 60px rgba(0,0,0,0.20)",
        border:`1px solid ${C.borderDefault}`,
        fontFamily:F.body,
        animation:"modalIn 0.20s cubic-bezier(0.16,1,0.3,1)",
        overflow:"hidden",
      }}>
        <div style={{height:2,background:`linear-gradient(90deg,transparent 0%,${C.red}90 30%,${C.red}90 70%,transparent 100%)`}}/>
        <div style={{background:C.headerGradient,padding:"18px 22px 16px",borderBottom:`1px solid ${C.divider}`}}>
          <div style={{fontFamily:F.label,fontSize:9,letterSpacing:"0.22em",color:C.red,fontWeight:700,textTransform:"uppercase",marginBottom:5,opacity:0.85}}>
            Cancel Reservation
          </div>
          <div style={{fontFamily:F.display,fontSize:17,fontWeight:600,color:C.textPrimary,lineHeight:1.2}}>
            {reservation.name||"Reservation"}
          </div>
          <div style={{fontFamily:F.body,fontSize:11,color:C.textSecondary,marginTop:4}}>
            {reservation.reference_code} · {reservation.room || "—"}
          </div>
        </div>
        <div style={{padding:"20px 22px 24px"}}>
          <div style={{padding:"10px 14px",borderRadius:8,marginBottom:14,background:C.redFaint,border:`1px solid ${C.redBorder}`,fontFamily:F.body,fontSize:12,color:C.textSecondary,lineHeight:1.65}}>
            This will cancel the reservation, notify the guest via email, and record the cancellation in the audit trail. This action cannot be undone.
          </div>
          <div style={{marginBottom:16}}>
            <span style={{display:"block",fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:C.textTertiary,marginBottom:7}}>
              Cancellation Reason *
            </span>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Provide a reason for cancellation (min 3 characters)..."
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              style={{
                width:"100%",padding:"10px 12px",
                border:`1.5px solid ${focused ? C.redBorder : C.borderDefault}`,
                borderRadius:8,background:C.surfaceInput,
                fontFamily:F.body,fontSize:13,color:C.textPrimary,
                outline:"none",resize:"vertical",minHeight:78,
                boxShadow:focused ? `0 0 0 3px ${C.redFaint}` : "none",
              }}
            />
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={onCancel} disabled={loading} style={{flex:1,padding:"11px",background:"transparent",border:`1px solid ${C.borderDefault}`,borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textSecondary,cursor:loading?"not-allowed":"pointer"}}>
              Go Back
            </button>
            <button
              onClick={() => onConfirm(reason.trim())}
              disabled={loading || !isValid}
              style={{
                flex:2,padding:"11px",
                background:loading||!isValid?"rgba(160,56,56,0.35)":C.red,
                border:"none",borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,
                letterSpacing:"0.14em",textTransform:"uppercase",color:"#fff",
                cursor:loading||!isValid?"not-allowed":"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                transition:"all 0.18s",
              }}
            >
              {loading?<><Spinner/>Cancelling...</>:"Confirm Cancellation"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ reservation, onClose, onApprove, onReject, onRevert, onCancel, onUpdate, canManage, canAdjust, venueRows }) {
  const [actionLoading,setActionLoading]=useState(null);
  const [showRejectModal,setShowRejectModal]=useState(false);
  const [showRevertModal,setShowRevertModal]=useState(false);
  const [showApproveModal,setShowApproveModal]=useState(false);
  const [showCancelModal,setShowCancelModal]=useState(false);
  const [isEditing,setIsEditing]=useState(false);
  const [showSaveModal,setShowSaveModal]=useState(false);
  const [editError,setEditError]=useState("");
  
  const [availableSubrooms, setAvailableSubrooms] = useState([]);
  const [loadingSubrooms, setLoadingSubrooms] = useState(false);

  const parentVenue = useMemo(() => {
    return venueRows?.find(v => v.name === reservation.room || v.display_name === reservation.room);
  }, [venueRows, reservation.room]);

  const hasChildren = useMemo(() => {
    return parentVenue && (parentVenue.children?.length > 0 || venueRows?.some(v => v.parent_id === parentVenue.id));
  }, [parentVenue, venueRows]);

  const [form,setForm]=useState({
    name: reservation.name || "",
    email: reservation.email || "",
    phone: reservation.phone || "",
    room: reservation.room || "",
    table_number: reservation.table_number || "",
    seat_number: reservation.seat_number || reservation.seat || "",
    guests_count: reservation.guests_count || reservation.guests || 1,
    event_date: reservation.event_date ? String(reservation.event_date).slice(0,10) : "",
    event_time: reservation.event_time || "",
    event_area: reservation.event_area || reservation.eventArea || "",
    setup_tables: reservation.setup_tables ?? reservation.setupTables ?? "",
    setup_chairs: reservation.setup_chairs ?? reservation.setupChairs ?? "",
    setup_requirements: reservation.setup_requirements || reservation.setupRequirements || "",
    special_requests: reservation.special_requests || "",
    type: reservation.type || "whole",
    assigned_room_id: reservation.assigned_room_id || "",
  });

  // Keep form state in sync with reservation prop updates (e.g. read-only assignments)
  useEffect(() => {
    setForm({
      name: reservation.name || "",
      email: reservation.email || "",
      phone: reservation.phone || "",
      room: reservation.room || "",
      table_number: reservation.table_number || "",
      seat_number: reservation.seat_number || reservation.seat || "",
      guests_count: reservation.guests_count || reservation.guests || 1,
      event_date: reservation.event_date ? String(reservation.event_date).slice(0,10) : "",
      event_time: reservation.event_time || "",
      event_area: reservation.event_area || reservation.eventArea || "",
      setup_tables: reservation.setup_tables ?? reservation.setupTables ?? "",
      setup_chairs: reservation.setup_chairs ?? reservation.setupChairs ?? "",
      setup_requirements: reservation.setup_requirements || reservation.setupRequirements || "",
      special_requests: reservation.special_requests || "",
      type: reservation.type || "whole",
      assigned_room_id: reservation.assigned_room_id || "",
    });
  }, [reservation]);

  useEffect(() => {
    if (!hasChildren || !parentVenue) return;

    const fetchAvailableSubrooms = async () => {
      setLoadingSubrooms(true);
      try {
        const date = form.event_date || (reservation.event_date ? String(reservation.event_date).slice(0, 10) : "");
        const time = form.event_time || reservation.event_time || "";
        const guests = form.guests_count || reservation.guests_count || reservation.guests || 1;
        
        // Strictly use integer DB ID. Fallback only if reservation.id is an integer.
        // Never send string reference code (e.g. "2026-1031") as ignore_reservation_id.
        const ignoreId = reservation.db_id || (Number.isInteger(Number(reservation.id)) ? Number(reservation.id) : null);

        const token = localStorage.getItem("admin_token");
        const url = `${API_BASE_URL}/venues/${parentVenue.id}/available-subrooms?date=${date}&time=${time}&guests_count=${guests}${ignoreId ? `&ignore_reservation_id=${ignoreId}` : ""}`;
        const response = await fetch(url, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (response.ok) {
          const data = await response.json();
          setAvailableSubrooms(Array.isArray(data) ? data : data.subrooms || []);
        }
      } catch (err) {
        console.error("Error fetching available subrooms:", err);
      } finally {
        setLoadingSubrooms(false);
      }
    };

    fetchAvailableSubrooms();
  }, [parentVenue, hasChildren, form.event_date, form.event_time, form.guests_count, reservation.event_date, reservation.event_time, reservation.guests_count, reservation.db_id, reservation.id]);

  const currentAssignedId = Number(reservation.assigned_room_id);
  const options = useMemo(() => {
    const opts = [...availableSubrooms];
    if (currentAssignedId && !opts.some(sub => Number(sub.id) === currentAssignedId)) {
      const assignedName = reservation.internal_room_name || "Currently Assigned Room";
      opts.push({
        id: currentAssignedId,
        name: assignedName,
        display_name: assignedName,
      });
    }
    return opts;
  }, [availableSubrooms, currentAssignedId, reservation.internal_room_name]);

  const fmtDate=(d)=>{
    if(!d)return"—";
    try{return new Date(d+"T00:00:00").toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"});}
    catch{return d;}
  };
  const fmtTime=(t)=>{
    if(!t)return"—";
    const[h,m]=t.split(":");const hr=parseInt(h);
    return`${hr%12||12}:${m} ${hr>=12?"PM":"AM"}`;
  };
  const fmtDateTime=(value)=>{
    if(!value)return"—";
    try{return new Date(value).toLocaleString("en-US",{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}
    catch{return value;}
  };

  const handleApproveConfirm=async()=>{
    setActionLoading("approve");
    await onApprove(reservation);
    setActionLoading(null);
    setShowApproveModal(false);
    onClose();
  };

  const handleRejectConfirm=async(reason)=>{
    setActionLoading("reject");
    await onReject(reservation,reason);
    setActionLoading(null);
    setShowRejectModal(false);
    onClose();
  };

   const handleRevertConfirm=async()=>{
    setActionLoading("revert");
    await onRevert(reservation);
    setActionLoading(null);
    setShowRevertModal(false);
    onClose();
  };

  const handleCancelConfirm=async(reason)=>{
    setActionLoading("cancel");
    await onCancel(reservation, reason);
    setActionLoading(null);
    setShowCancelModal(false);
    onClose();
  };

  const normalizeForm = () => ({
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim(),
    room: form.room.trim(),
    table_number: form.type === "standalone" ? "STANDALONE" : form.table_number.trim(),
    seat_number: form.seat_number.trim(),
    guests_count: Number(form.guests_count),
    event_date: form.event_date,
    event_time: form.event_time,
    event_area: form.event_area.trim(),
    setup_tables: form.setup_tables === "" ? null : Number(form.setup_tables),
    setup_chairs: form.setup_chairs === "" ? null : Number(form.setup_chairs),
    setup_requirements: form.setup_requirements.trim(),
    special_requests: form.special_requests.trim(),
    type: form.type,
    is_standalone: form.type === "standalone",
    assigned_room_id: form.assigned_room_id ? Number(form.assigned_room_id) : null,
  });

  const getChangedFields = () => {
    const payload = normalizeForm();
    const current = {
      name: reservation.name || "",
      email: reservation.email || "",
      phone: reservation.phone || "",
      room: reservation.room || "",
      table_number: reservation.table_number || "",
      seat_number: reservation.seat_number || reservation.seat || "",
      guests_count: Number(reservation.guests_count || reservation.guests || 1),
      event_date: reservation.event_date ? String(reservation.event_date).slice(0,10) : "",
      event_time: reservation.event_time || "",
      event_area: reservation.event_area || reservation.eventArea || "",
      setup_tables: reservation.setup_tables ?? reservation.setupTables ?? null,
      setup_chairs: reservation.setup_chairs ?? reservation.setupChairs ?? null,
      setup_requirements: reservation.setup_requirements || reservation.setupRequirements || "",
      special_requests: reservation.special_requests || "",
      type: reservation.type || "whole",
      is_standalone: reservation.type === "standalone" || reservation.is_standalone === true || reservation.is_standalone === 1,
      assigned_room_id: reservation.assigned_room_id || null,
    };

    return Object.entries(payload).filter(([field,value]) => String(value ?? "") !== String(current[field] ?? ""));
  };

  const handleReviewSave=()=>{
    const payload = normalizeForm();
    if (!payload.name || !payload.email || !payload.phone || !payload.event_date || !payload.event_time || !payload.guests_count || payload.guests_count < 1) {
      setEditError("Complete the required reservation and guest fields before saving.");
      return;
    }
    if (payload.type !== "standalone" && !payload.table_number) {
      setEditError("Add a table number, or choose Standalone Seat as the reservation type.");
      return;
    }
    if (getChangedFields().length === 0) {
      setEditError("No reservation details were changed.");
      return;
    }
    setEditError("");
    setShowSaveModal(true);
  };

  const handleSaveConfirm=async()=>{
    setActionLoading("save");
    const result = await onUpdate(reservation, normalizeForm());
    setActionLoading(null);
    if (result?.success) {
      setShowSaveModal(false);
      setIsEditing(false);
      onClose();
    } else {
      setShowSaveModal(false);
      setEditError(result?.message || "Failed to update reservation details.");
    }
  };

  const isPending=(reservation.status||"").toLowerCase()==="pending";
  const isRejected=(reservation.status||"").toLowerCase()==="rejected";

  const isStandaloneReservation =
    String(reservation.table_number || "").toUpperCase() === "STANDALONE" ||
    reservation.type === "standalone" ||
    reservation.is_standalone === 1 ||
    reservation.is_standalone === true;
  const reservationState = getReservationState(reservation);

  const resRows=[
    ["Reference",  reservation.reference_code||"—"],
    ["Room",       reservation.room||"—"],
    ["Type",       isStandaloneReservation ? "Standalone Seat" : reservation.type === "whole" ? "Whole Table" : "Individual Seat"],
    ...(!isStandaloneReservation ? [["Table", formatTableNumber(reservation.table_number)]] : []),
    ["Seat",       (reservation.seat||reservation.seat_number)?`Seat ${reservation.seat||reservation.seat_number}`:"—"],
    ["Guests",     (reservation.guests_count || reservation.guests) ? `${reservation.guests_count || reservation.guests} guest${(reservation.guests_count || reservation.guests) !== 1 ? "s" : ""}` : "—"],
    ["Event Date", fmtDate(reservation.event_date)],
    ["Event Time", fmtTime(reservation.event_time)],
    ...((reservation.event_area || reservation.eventArea) ? [["Event Area", reservation.event_area || reservation.eventArea]] : []),
    ...((reservation.setup_tables ?? reservation.setupTables) ? [["Tables Needed", reservation.setup_tables ?? reservation.setupTables]] : []),
    ...((reservation.setup_chairs ?? reservation.setupChairs) ? [["Chairs Needed", reservation.setup_chairs ?? reservation.setupChairs]] : []),
    ...((reservation.setup_requirements || reservation.setupRequirements) ? [["Setup Requirements", reservation.setup_requirements || reservation.setupRequirements]] : []),
  ];

  const guestRows=[
    ["Full Name",        reservation.name||"—"],
    ["Email",            reservation.email||"—"],
    ["Phone",            reservation.phone||"—"],
    ["Special Requests", reservation.special_requests||"None"],
  ];
  const trackingRows=[
    ["Previous Status", reservation.previous_status || "—"],
    ["Last Status Change", fmtDateTime(reservation.status_last_changed_at)],
    ["Rejected At", fmtDateTime(reservation.rejected_at)],
    ["Reverted At", fmtDateTime(reservation.reverted_at)],
  ];
  const historyItems = Array.isArray(reservation.transaction_history)
    ? reservation.transaction_history.slice(0, 6)
    : [];
  const formatHistoryAction = (action) => String(action || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Transaction";

  const getActorLabel = (item) => {
    if (item.action === 'cancelled_by_guest') {
      return 'Guest';
    }
    const name = item.actor_name;
    const role = item.actor_role;
    if (!name) return 'System';
    return role ? `${name} (${role})` : name;
  };

  const getTransactionNotes = (item) => {
    if (item.action === 'cancelled_by_admin' && item.metadata?.reason) {
      return item.metadata.reason;
    }
    if (item.action === 'cancelled_by_guest' && item.metadata?.reason) {
      return item.metadata.reason;
    }
    return item.notes || '';
  };

  const renderActivityTimeline = () => {
    const historyItems = Array.isArray(reservation.transaction_history)
      ? [...reservation.transaction_history].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      : [];

    if (historyItems.length === 0) {
      return (
        <div style={{ fontFamily: F.body, fontSize: 11, color: C.textSecondary }}>
          No activity history recorded yet.
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 0, position: "relative", paddingLeft: 14 }}>
        <div style={{
          position: "absolute",
          left: 4,
          top: 8,
          bottom: 8,
          width: 1.5,
          background: C.divider,
        }} />

        {historyItems.map((item, idx) => {
          const actor = getActorLabel(item);
          const notes = getTransactionNotes(item);
          const isLast = idx === historyItems.length - 1;

          let markerColor = C.gold;
          let markerBg = C.goldFaint;
          if (item.action?.includes('approve') || (item.action === 'status_changed' && item.to_status === 'reserved')) {
            markerColor = C.green;
            markerBg = C.greenFaint;
          } else if (item.action?.includes('reject') || item.action?.includes('cancel')) {
            markerColor = C.red;
            markerBg = C.redFaint;
          }

          return (
            <div key={item.id || `${item.action}-${idx}`} style={{
              position: "relative",
              paddingBottom: isLast ? 0 : 16,
            }}>
              <div style={{
                position: "absolute",
                left: -14.5,
                top: 4,
                width: 9,
                height: 9,
                borderRadius: "50%",
                background: markerColor,
                border: `2px solid ${C.surfaceBase}`,
                boxShadow: `0 0 0 2px ${markerBg}`,
                zIndex: 2,
              }} />

              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
                  <span style={{
                    fontFamily: F.display,
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: C.textPrimary,
                    textTransform: "capitalize"
                  }}>
                    {formatHistoryAction(item.action)}
                  </span>
                  <span style={{ fontFamily: F.body, fontSize: 9.5, color: C.textTertiary, whiteSpace: "nowrap" }}>
                    {fmtDateTime(item.created_at)}
                  </span>
                </div>

                <div style={{ fontFamily: F.body, fontSize: 10.5, color: C.textSecondary, marginTop: 3 }}>
                  <span style={{ fontWeight: 600, color: C.textPrimary }}>{actor}</span>
                  {notes && (
                    <div style={{
                      marginTop: 4,
                      padding: "5px 8px",
                      background: C.surfaceInput,
                      border: `1px solid ${C.borderDefault}`,
                      borderRadius: 6,
                      fontSize: 10.5,
                      color: C.textSecondary,
                      fontStyle: "italic",
                      lineHeight: 1.35,
                      whiteSpace: "pre-wrap"
                    }}>
                      &ldquo;{notes}&rdquo;
                    </div>
                  )}
                </div>

                {item.metadata?.changes && Object.keys(item.metadata.changes).length > 0 && (
                  <ul style={{
                    margin: "5px 0 0 0",
                    paddingLeft: 18,
                    fontFamily: F.body,
                    fontSize: 10,
                    color: C.textSecondary,
                    listStyleType: "disc",
                  }}>
                    {Object.entries(item.metadata.changes).map(([field, diff]) => (
                      <li key={field} style={{ marginBottom: 2 }}>
                        <strong style={{ color: C.textPrimary }}>{formatFieldName(field)}</strong>:{" "}
                        <span style={{ textDecoration: "line-through", color: C.textTertiary }}>
                          {formatValue(field, diff.from)}
                        </span>{" "}
                        &rarr;{" "}
                        <span style={{ fontWeight: 600, color: C.gold }}>
                          {formatValue(field, diff.to)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };
  const editSummaryRows = [
    ["Reference", reservation.reference_code || "-"],
    ["Room", form.room || "-"],
    ["Type", form.type === "standalone" ? "Standalone Seat" : form.type === "whole" ? "Whole Table" : "Individual Seat"],
    ["Table", form.type === "standalone" ? "STANDALONE" : form.table_number || "-"],
    ["Seat", form.seat_number || "-"],
    ["Guests", form.guests_count ? `${form.guests_count} guest${Number(form.guests_count) === 1 ? "" : "s"}` : "-"],
    ["Date", form.event_date || "-"],
    ["Time", form.event_time ? fmtTime(form.event_time) : "-"],
  ];

  return (
    <>
      <div
        style={{
          position:"fixed",inset:0,
          background:C.modalOverlay,
          zIndex:4000,
          display:"flex",justifyContent:"flex-end",
          backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",
        }}
        onClick={(e)=>{if(e.target===e.currentTarget&&!actionLoading)onClose();}}
      >
        <div style={{
          background:C.surfaceBase,
          width:"100%",maxWidth:isEditing?900:800,
          height:"100%",
          boxShadow:"-16px 0 40px rgba(0,0,0,0.16)",
          borderLeft:`1px solid ${C.borderDefault}`,
          fontFamily:F.body,
          animation:"drawerSlideIn 0.3s cubic-bezier(0.16,1,0.3,1)",
          display:"flex",flexDirection:"column",
        }}>
          <div style={{height:2,background:`linear-gradient(90deg,transparent 0%,${C.gold}80 30%,${C.gold}80 70%,transparent 100%)`,flexShrink:0}}/>

          <div style={{
            background:C.headerGradient,
            padding:"18px 22px 16px",
            borderBottom:`1px solid ${C.divider}`,
            display:"flex",alignItems:"flex-start",justifyContent:"space-between",
            flexShrink:0,
          }}>
            <div style={{flex:1,paddingRight:14}}>
              <div style={{fontFamily:F.label,fontSize:9,letterSpacing:"0.22em",color:C.gold,fontWeight:700,textTransform:"uppercase",marginBottom:5,opacity:0.80}}>
                {isStandaloneReservation ? "Standalone Seat Reservation" : "Reservation Detail"}
              </div>
              <div style={{fontFamily:F.display,fontSize:19,fontWeight:600,color:C.textPrimary,lineHeight:1.2,marginBottom:8}}>
                {reservation.name||"—"}
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                <StatusBadge status={reservation.status}/>
                <StateBadge state={reservationState}/>
                {isStandaloneReservation && (
                  <span style={{
                    display:"inline-flex",alignItems:"center",gap:4,
                    padding:"3px 9px",
                    background:"rgba(140,107,42,0.09)",
                    border:`1px solid rgba(140,107,42,0.25)`,
                    borderRadius:20,
                    fontFamily:F.label,fontSize:9,fontWeight:700,
                    letterSpacing:"0.10em",textTransform:"uppercase",
                    color:C.gold,
                  }}>
                    Standalone
                  </span>
                )}
              </div>
            </div>
            <button onClick={onClose} disabled={!!actionLoading}
              style={{
                width:30,height:30,borderRadius:"50%",background:"transparent",
                border:`1px solid ${C.borderDefault}`,cursor:actionLoading?"not-allowed":"pointer",
                display:"flex",alignItems:"center",justifyContent:"center",
                flexShrink:0,transition:"border-color 0.18s",padding:0,
              }}
              onMouseEnter={(e)=>{if(!actionLoading)e.currentTarget.style.borderColor=C.gold;}}
              onMouseLeave={(e)=>{e.currentTarget.style.borderColor=C.borderDefault;}}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                stroke={C.textSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <div style={{padding:"18px 22px 24px",overflowY:"auto",flex:1}}>
            {isEditing ? (
              <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 280px",gap:18,alignItems:"start"}}>
                <div>
                  <SectionLabel>Update Reservation Details</SectionLabel>
                  <ReservationEditForm
                    form={form}
                    setForm={setForm}
                    disabled={!!actionLoading}
                    hasChildren={hasChildren}
                    availableSubrooms={availableSubrooms}
                    loadingSubrooms={loadingSubrooms}
                  />
                  {editError && (
                    <div style={{marginTop:12,padding:"9px 12px",borderRadius:8,background:C.redFaint,border:`1px solid ${C.redBorder}`,fontFamily:F.body,fontSize:12,color:C.red,lineHeight:1.5}}>
                      {editError}
                    </div>
                  )}
                </div>
                <aside style={{position:"sticky",top:0,display:"grid",gap:12,padding:14,borderRadius:12,background:C.goldFaintest,border:`1px solid ${C.borderAccent}`}}>
                  <div>
                    <div style={{fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.16em",textTransform:"uppercase",color:C.gold,marginBottom:8}}>
                      Edit Summary
                    </div>
                    {editSummaryRows.map(([label,value])=>(
                      <div key={label} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"8px 0",borderBottom:`1px solid ${C.divider}`}}>
                        <span style={{fontFamily:F.label,fontSize:8.5,fontWeight:800,letterSpacing:"0.13em",textTransform:"uppercase",color:C.textTertiary}}>{label}</span>
                        <span style={{fontFamily:F.body,fontSize:12.5,fontWeight:label==="Reference"?700:560,color:label==="Reference"?C.gold:C.textPrimary,textAlign:"right",lineHeight:1.4,maxWidth:150,overflowWrap:"anywhere"}}>{value}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{padding:"10px 12px",borderRadius:9,background:C.surfaceInput,border:`1px solid ${C.borderDefault}`,fontFamily:F.body,fontSize:11.5,color:C.textSecondary,lineHeight:1.55}}>
                    Review changes before saving. A reservation history entry will be recorded for audit tracking.
                  </div>
                  <button
                    onClick={()=>{setIsEditing(false);setEditError("");}}
                    disabled={!!actionLoading}
                    style={{width:"100%",padding:"11px",background:"transparent",border:`1px solid ${C.borderDefault}`,borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textSecondary,cursor:actionLoading?"not-allowed":"pointer"}}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleReviewSave}
                    disabled={!!actionLoading}
                    style={{width:"100%",padding:"11px",background:C.gold,border:"none",borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"#fff",cursor:actionLoading?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7}}
                  >
                    Review Changes
                  </button>
                </aside>
              </div>
            ) : (
              <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 300px",gap:20,alignItems:"start"}}>
                {/* Left Column: Core Data cards */}
                <div style={{display:"flex",flexDirection:"column",gap:16}}>
                  
                  {/* Reservation Details Card */}
                  <div style={{
                    background: C.surfaceInput,
                    border: `1px solid ${C.borderDefault}`,
                    borderRadius: 12,
                    padding: "16px 18px",
                  }}>
                    <SectionLabel style={{marginTop: 0, marginBottom: 12}}>Reservation Details</SectionLabel>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:"10px 20px"}}>
                      {resRows.filter(([label]) => label !== "Setup Requirements").map(([label,value]) => (
                        <div key={label} style={{
                          display:"flex",flexDirection:"column",gap:4,
                          padding:"6px 0",
                          borderBottom:`1px solid ${C.divider}`,
                        }}>
                          <span style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>{label}</span>
                          <span style={{fontFamily:F.body,fontSize:12.5,color:label==="Reference"?C.gold:C.textPrimary,fontWeight:label==="Reference"?700:500,lineHeight:1.4}}>{value}</span>
                        </div>
                      ))}
                    </div>

                    {/* Setup Requirements (Full Width below details grid if present) */}
                    {(reservation.setup_requirements || reservation.setupRequirements) ? (
                      <div style={{
                        display:"flex",flexDirection:"column",gap:4,
                        padding:"10px 0 0",
                        marginTop: 12,
                        borderTop: `1.5px dashed ${C.divider}`,
                      }}>
                        <span style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Setup Requirements</span>
                        <div style={{
                          fontFamily:F.body,fontSize:12,color:C.textSecondary,lineHeight:1.55,
                          background: C.surfaceBase, padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderDefault}`,
                          whiteSpace: "pre-wrap"
                        }}>
                          {reservation.setup_requirements || reservation.setupRequirements}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* Guest Information Card */}
                  <div style={{
                    background: C.surfaceInput,
                    border: `1px solid ${C.borderDefault}`,
                    borderRadius: 12,
                    padding: "16px 18px",
                  }}>
                    <SectionLabel style={{marginTop: 0, marginBottom: 12}}>Guest Information</SectionLabel>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(2, 1fr)",gap:"10px 20px"}}>
                      {guestRows.filter(([label]) => label !== "Special Requests").map(([label,value]) => (
                        <div key={label} style={{
                          display:"flex",flexDirection:"column",gap:4,
                          padding:"6px 0",
                          borderBottom:`1px solid ${C.divider}`,
                        }}>
                          <span style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>{label}</span>
                          <span style={{fontFamily:F.body,fontSize:12.5,color:C.textPrimary,fontWeight:500,lineHeight:1.4}}>{value}</span>
                        </div>
                      ))}
                    </div>
                    {/* Special Requests (Full Width below) */}
                    <div style={{
                      display:"flex",flexDirection:"column",gap:4,
                      padding:"10px 0 0",
                      marginTop: 12,
                      borderTop: `1.5px dashed ${C.divider}`,
                    }}>
                      <span style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Special Requests</span>
                      <div style={{
                        fontFamily:F.body,fontSize:12,color:reservation.special_requests ? C.textPrimary : C.textTertiary,lineHeight:1.55,
                        background: C.surfaceBase, padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderDefault}`,
                        fontStyle: reservation.special_requests ? "normal" : "italic"
                      }}>
                        {reservation.special_requests || "None specified"}
                      </div>
                    </div>
                  </div>

                </div>

                {/* Right Column: Actions, Allocation, History */}
                <aside style={{position:"sticky",top:0,display:"flex",flexDirection:"column",gap:16}}>
                  
                  {/* Room Allocation Panel */}
                  {hasChildren && (
                    <div style={{
                      background: C.goldFaintest,
                      border: `1.5px solid ${C.borderAccent}`,
                      borderRadius: 12,
                      padding: "14px 16px",
                      display: "grid",
                      gap: 12,
                    }}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <span style={{fontFamily:F.label,fontSize:8.5,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.gold}}>
                          Allocation Status
                        </span>
                        <span style={{
                          fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.10em",textTransform:"uppercase",
                          padding:"3px 8px",
                          borderRadius:12,
                          background: (reservation.assigned_room_id || reservation.internal_room_name === 'Whole Venue') ? C.greenFaint : C.badgePending.bg,
                          color: (reservation.assigned_room_id || reservation.internal_room_name === 'Whole Venue') ? C.green : C.badgePending.color,
                          border: `1px solid ${(reservation.assigned_room_id || reservation.internal_room_name === 'Whole Venue') ? C.greenBorder : C.borderAccent}`,
                        }}>
                          {reservation.internal_room_name === 'Whole Venue' ? 'whole parent' : (reservation.assignment_status ? reservation.assignment_status.replace(/_/g," ") : (reservation.assigned_room_id ? "assigned" : "pending"))}
                        </span>
                      </div>

                      <div style={{display:"grid",gap:6}}>
                        <span style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>
                          Assigned Subroom
                        </span>
                        {reservation.internal_room_name === 'Whole Venue' ? (
                          <div style={{fontFamily:F.body,fontSize:12.5,fontWeight:600,color:C.textPrimary}}>
                            Whole Parent Venue Blocked (No child assignment needed)
                          </div>
                        ) : canManage ? (
                          <div style={{display:"flex",alignItems:"center",gap:6}}>
                            <select
                              disabled={loadingSubrooms || actionLoading === "save_subroom"}
                              value={reservation.assigned_room_id || ""}
                              onChange={async (e) => {
                                const val = e.target.value ? Number(e.target.value) : null;
                                setActionLoading("save_subroom");
                                await onUpdate(reservation, {
                                  assigned_room_id: val
                                });
                                setActionLoading(null);
                              }}
                              style={{
                                ...editInputStyle(false),
                                cursor: (loadingSubrooms || actionLoading === "save_subroom") ? "not-allowed" : "pointer",
                                padding: "6px 10px",
                                fontSize: 12,
                                border: `1.5px solid ${C.borderAccent}`,
                                background: C.surfaceBase,
                              }}
                            >
                              <option value="">-- Needs Room Assignment --</option>
                              {options.map(sub => (
                                <option key={sub.id} value={sub.id}>
                                  {sub.display_name || sub.name} (Cap: {sub.capacity || "N/A"})
                                </option>
                              ))}
                            </select>
                            {loadingSubrooms && <Spinner />}
                          </div>
                        ) : (
                          <div style={{fontFamily:F.body,fontSize:12.5,fontWeight:600,color:C.textPrimary}}>
                            {reservation.internal_room_name || "Not assigned (Pending)"}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Actions & Controls */}
                  <div style={{
                    background: C.surfaceInput,
                    border: `1px solid ${C.borderDefault}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                  }}>
                    <span style={{fontFamily:F.label,fontSize:8.5,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary,display:"block",marginBottom:10}}>
                      Reservation Controls
                    </span>
                    {isPending && canManage ? (
                      <div style={{display:"grid",gap:8}}>
                        <button
                          onClick={()=>setShowApproveModal(true)}
                          disabled={!!actionLoading}
                          style={{
                            width:"100%",padding:"9px",border:"none",borderRadius:8,
                            background:actionLoading?"rgba(46,122,90,0.45)":C.green,
                            color:"#fff",fontFamily:F.label,fontSize:9,fontWeight:700,
                            letterSpacing:"0.14em",textTransform:"uppercase",
                            cursor:actionLoading?"not-allowed":"pointer",transition:"all 0.18s",
                            display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                          }}
                          onMouseEnter={(e)=>{if(!actionLoading)e.currentTarget.style.background="#256648";}}
                          onMouseLeave={(e)=>{if(!actionLoading)e.currentTarget.style.background=C.green;}}
                        >
                          {actionLoading==="approve"?<><Spinner/>Approving…</>:"Approve & Notify"}
                        </button>
                        <button
                          onClick={()=>setShowRejectModal(true)}
                          disabled={!!actionLoading}
                          style={{
                            width:"100%",padding:"9px",
                            background:"transparent",border:`1px solid ${C.redBorder}`,
                            borderRadius:8,fontFamily:F.label,fontSize:9,fontWeight:700,
                            letterSpacing:"0.14em",textTransform:"uppercase",
                            color:C.red,cursor:actionLoading?"not-allowed":"pointer",
                            transition:"all 0.18s",
                            display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                          }}
                          onMouseEnter={(e)=>{if(!actionLoading)e.currentTarget.style.background=C.redFaint;}}
                          onMouseLeave={(e)=>{if(!actionLoading)e.currentTarget.style.background="transparent";}}
                        >
                          {actionLoading==="reject"?<><Spinner/>Rejecting…</>:"Reject"}
                        </button>
                      </div>
                    ) : (
                      <div style={{display:"grid",gap:8}}>
                        {(!canManage || isRejected) && (
                          <div style={{
                            padding:"8px 10px",borderRadius:6,
                            background:C.statusNote[(reservation.status||"pending").toLowerCase()]||C.goldFaintest,
                            border:`1px solid ${C.statusNoteBorder[(reservation.status||"pending").toLowerCase()]||C.borderAccent}`,
                            fontFamily:F.body,fontSize:11,color:C.textSecondary,lineHeight:1.5,
                          }}>
                            {canManage
                              ? <>This reservation is <strong style={{color:C.textPrimary}}>{(reservation.status||"").toLowerCase()}</strong>.</>
                              : <>Your account is in read-only mode for this record.</>}
                          </div>
                        )}
                        {isRejected && canManage && (
                          <button
                            onClick={()=>setShowRevertModal(true)}
                            disabled={!!actionLoading}
                            style={{
                              width:"100%",padding:"9px",
                              border:"none",borderRadius:8,
                              background:actionLoading?"rgba(140,107,42,0.45)":C.gold,
                              color:"#fff",fontFamily:F.label,fontSize:9,fontWeight:700,
                              letterSpacing:"0.14em",textTransform:"uppercase",
                              cursor:actionLoading?"not-allowed":"pointer",transition:"all 0.18s",
                              display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                            }}
                            onMouseEnter={(e)=>{if(!actionLoading)e.currentTarget.style.background=C.goldLight;}}
                            onMouseLeave={(e)=>{if(!actionLoading)e.currentTarget.style.background=C.gold;}}
                          >
                            {actionLoading==="revert"?<><Spinner/>Reverting...</>:"Revert to Pending"}
                          </button>
                        )}
                      </div>
                    )}
                    {canAdjust && (
                      <button
                        onClick={()=>setIsEditing(true)}
                        disabled={!!actionLoading}
                        style={{
                          width:"100%",marginTop:8,padding:"9px",
                          background:"transparent",border:`1px solid ${C.borderAccent}`,
                          borderRadius:8,fontFamily:F.label,fontSize:9,fontWeight:700,
                          letterSpacing:"0.14em",textTransform:"uppercase",
                          color:C.gold,cursor:actionLoading?"not-allowed":"pointer"
                        }}
                      >
                        Modify Details
                      </button>
                    )}
                    {["pending", "approved", "reserved"].includes((reservation.status || "").toLowerCase()) && canManage && (
                      <button
                        onClick={() => setShowCancelModal(true)}
                        disabled={!!actionLoading}
                        style={{
                          width:"100%",marginTop:8,padding:"9px",
                          background:"transparent",border:`1px solid ${C.redBorder}`,
                          borderRadius:8,fontFamily:F.label,fontSize:9,fontWeight:700,
                          letterSpacing:"0.14em",textTransform:"uppercase",
                          color:C.red,cursor:actionLoading?"not-allowed":"pointer",
                          transition:"all 0.18s",
                          display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                        }}
                        onMouseEnter={(e)=>{if(!actionLoading)e.currentTarget.style.background=C.redFaint;}}
                        onMouseLeave={(e)=>{if(!actionLoading)e.currentTarget.style.background="transparent";}}
                      >
                        {actionLoading==="cancel"?<><Spinner/>Cancelling...</>:"Cancel Reservation"}
                      </button>
                    )}
                  </div>

                  {/* History & Tracking */}
                  <div style={{
                    background: C.surfaceInput,
                    border: `1px solid ${C.borderDefault}`,
                    borderRadius: 12,
                    padding: "14px 16px",
                    maxHeight: 350,
                    overflowY: "auto",
                  }}>
                    <span style={{fontFamily:F.label,fontSize:8.5,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary,display:"block",marginBottom:10}}>
                      Reservation Activity & Audit Trail
                    </span>
                    {renderActivityTimeline()}
                  </div>

                </aside>
              </div>
            )}
          </div>
        </div>
      </div>

      {showRejectModal&&(
        <RejectReasonModal
          reservation={reservation}
          onConfirm={handleRejectConfirm}
          onCancel={()=>setShowRejectModal(false)}
          loading={actionLoading==="reject"}
        />
      )}
      {showApproveModal&&(
        <ApproveConfirmModal
          reservation={reservation}
          onConfirm={handleApproveConfirm}
          onCancel={()=>setShowApproveModal(false)}
          loading={actionLoading==="approve"}
        />
      )}
      {showRevertModal&&(
        <RevertConfirmModal
          reservation={reservation}
          onConfirm={handleRevertConfirm}
          onCancel={()=>setShowRevertModal(false)}
          loading={actionLoading==="revert"}
        />
      )}
      {showSaveModal&&(
        <SaveChangesConfirmModal
          reservation={reservation}
          changes={getChangedFields().map(([field,value])=>[
            field.replace(/_/g," "),
            field === "is_standalone" ? (value ? "Yes" : "No") : 
            field === "assigned_room_id" ? (value ? (availableSubrooms.find(s=>s.id===Number(value))?.display_name || availableSubrooms.find(s=>s.id===Number(value))?.name || `Subroom #${value}`) : "Unassigned") :
            String(value || "-")
          ])}
          onConfirm={handleSaveConfirm}
          onCancel={()=>setShowSaveModal(false)}
          loading={actionLoading==="save"}
        />
      )}
      {showCancelModal && (
        <CancelConfirmModal
          reservation={reservation}
          onConfirm={handleCancelConfirm}
          onCancel={()=>setShowCancelModal(false)}
          loading={actionLoading==="cancel"}
        />
      )}
    </>
  );
}

// ─── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(()=>{const t=setTimeout(onClose,4500);return()=>clearTimeout(t);},[onClose]);
  const isSuccess=type==="success";
  return (
    <div style={{
      position:"fixed",bottom:24,right:24,zIndex:9999,
      display:"flex",alignItems:"center",gap:10,
      padding:"12px 18px",
      background:C.surfaceBase,
      border:`1px solid ${isSuccess?C.greenBorder:C.redBorder}`,
      borderRadius:10,
      boxShadow:"0 8px 28px rgba(0,0,0,0.12)",
      fontFamily:F.body,fontSize:13,
      animation:"fadeUp 0.22s ease",
      maxWidth:400,
    }}>
      <span style={{width:7,height:7,borderRadius:"50%",background:isSuccess?C.green:C.red,flexShrink:0}}/>
      <span style={{color:C.textPrimary,flex:1,lineHeight:1.5}}>{message}</span>
      <button onClick={onClose} style={{background:"transparent",border:"none",cursor:"pointer",padding:0,color:C.textSecondary,display:"flex",alignItems:"center"}}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Pagination Controls ───────────────────────────────────────────────────────
function PaginationControls({ pagination, onPageChange, onRowsChange, filteredCount, isMobile }) {
  const { currentPage, lastPage, rowsPerPage } = pagination;

  const getPageNumbers = () => {
    if (lastPage <= 7) return Array.from({ length: lastPage }, (_, i) => i + 1);
    const pages = [];
    const start = Math.max(2, currentPage - 1);
    const end   = Math.min(lastPage - 1, currentPage + 1);
    pages.push(1);
    if (start > 2) pages.push("...");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < lastPage - 1) pages.push("...");
    pages.push(lastPage);
    return pages;
  };

  const btnBase = {
    minWidth: 32, height: 32,
    display: "flex", alignItems: "center", justifyContent: "center",
    border: `1px solid ${C.borderDefault}`,
    borderRadius: 7,
    background: "transparent",
    fontFamily: F.label, fontSize: 11, fontWeight: 600,
    cursor: "pointer", transition: "all 0.15s",
    color: C.textSecondary, padding: "0 6px",
  };

  return (
    <div style={{
      padding: isMobile ? "12px 14px" : "12px 22px",
      borderTop: `1px solid ${C.divider}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      flexWrap: "wrap",
      gap: 10,
      background: C.headerGradient,
    }}>
      <div style={{ fontFamily: F.body, fontSize: 11, color: C.textTertiary, whiteSpace: "nowrap" }}>
        Showing{" "}
        <strong style={{ color: C.textSecondary }}>
          {filteredCount === 0 ? 0 : (currentPage - 1) * rowsPerPage + 1}–{Math.min(currentPage * rowsPerPage, filteredCount)}
        </strong>{" "}
        of <strong style={{ color: C.textSecondary }}>{filteredCount}</strong>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          style={{ ...btnBase, color: currentPage <= 1 ? C.textTertiary : C.textSecondary, cursor: currentPage <= 1 ? "not-allowed" : "pointer", paddingLeft: 10, paddingRight: 10 }}
          onMouseEnter={(e) => { if (currentPage > 1) { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.color = C.gold; }}}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.color = currentPage <= 1 ? C.textTertiary : C.textSecondary; }}
        >
          ‹ {!isMobile && <span style={{ marginLeft: 3, fontSize: 10, letterSpacing: "0.08em" }}>Prev</span>}
        </button>

        {getPageNumbers().map((p, idx) =>
          p === "..." ? (
            <span key={`e-${idx}`} style={{ width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.textTertiary }}>…</span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              style={{ ...btnBase, border: currentPage === p ? `1px solid ${C.gold}` : `1px solid ${C.borderDefault}`, background: currentPage === p ? C.gold : "transparent", color: currentPage === p ? C.textOnAccent : C.textSecondary, fontWeight: currentPage === p ? 700 : 500, minWidth: 32 }}
              onMouseEnter={(e) => { if (currentPage !== p) { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.color = C.gold; }}}
              onMouseLeave={(e) => { if (currentPage !== p) { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.color = currentPage === p ? C.textOnAccent : C.textSecondary; }}}
            >
              {p}
            </button>
          )
        )}

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= lastPage}
          style={{ ...btnBase, color: currentPage >= lastPage ? C.textTertiary : C.textSecondary, cursor: currentPage >= lastPage ? "not-allowed" : "pointer", paddingLeft: 10, paddingRight: 10 }}
          onMouseEnter={(e) => { if (currentPage < lastPage) { e.currentTarget.style.borderColor = C.borderAccent; e.currentTarget.style.color = C.gold; }}}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.color = currentPage >= lastPage ? C.textTertiary : C.textSecondary; }}
        >
          {!isMobile && <span style={{ marginRight: 3, fontSize: 10, letterSpacing: "0.08em" }}>Next</span>} ›
        </button>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
        <span style={{ fontFamily: F.body, fontSize: 11, color: C.textTertiary, whiteSpace: "nowrap" }}>Rows per page:</span>
        <select
          value={rowsPerPage}
          onChange={(e) => onRowsChange(parseInt(e.target.value))}
          style={{ padding: "5px 10px", border: `1px solid ${C.borderDefault}`, borderRadius: 7, background: C.surfaceBase, fontFamily: F.body, fontSize: 11, color: C.textSecondary, cursor: "pointer", outline: "none" }}
        >
          <option value={10}>10</option>
          <option value={20}>20</option>
          <option value={50}>50</option>
        </select>
      </div>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ReservationDashboard() {
  const navigate = useNavigate();
  const location = useLocation();

  const canManageReservations = authAPI.hasPermission("manage_reservations");
  const canAdjustReservations = authAPI.hasPermission("adjust_reservation_details");
  const canDeleteReservations = authAPI.hasPermission("delete_reservations");
  const [reservations,setReservations]=useState([]);
  const [filteredReservations,setFilteredReservations]=useState([]);
  const [filterStatus,setFilterStatus]=useState("ALL");
  const [filterRoom,setFilterRoom]=useState("ALL");           // ← NEW
  const [filterPriority,setFilterPriority]=useState("ALL");
  const [filterType,setFilterType]=useState("ALL");
  const [quickFilter,setQuickFilter]=useState("ALL");
  const [sortBy,setSortBy]=useState("smart");
  const [search,setSearch]=useState("");
  const [selectedReservation,setSelectedReservation]=useState(null);
  const [showModal,setShowModal]=useState(false);
  const [sidebarOpen,setSidebarOpen]=useState(true);
  const [stats,setStats]=useState({total:0,pending:0,approved:0,rejected:0,active:0,inactive:0});
  const [toast,setToast]=useState(null);
  const [pagination,setPagination]=useState({currentPage:1,lastPage:1,totalItems:0,rowsPerPage:10});
  const [loading,setLoading]=useState(true);
  const [selectedReservations,setSelectedReservations]=useState(new Set());
  const [searchFocused,setSearchFocused]=useState(false);
  const [venueRows,setVenueRows]=useState([]);

  const pollingRef = useRef(null);
  const filterSignatureRef = useRef("");

  const [windowWidth,setWindowWidth]=useState(window.innerWidth);
  useEffect(()=>{
    const h=()=>setWindowWidth(window.innerWidth);
    window.addEventListener("resize",h);
    return()=>window.removeEventListener("resize",h);
  },[]);

  // Deep-linking helper to auto-open details modal when loaded via ?id=... or ?reservationId=...
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const resId = params.get("id") || params.get("reservationId");
    if (resId && reservations.length > 0) {
      const found = reservations.find((r) => String(r.id) === String(resId));
      if (found) {
        setSelectedReservation(found);
        setShowModal(true);
        // Clear query parameters from URL history for a clean UX
        navigate(location.pathname, { replace: true });
      }
    }
  }, [location.search, reservations, navigate, location.pathname]);

  const isMobile=windowWidth<640;
  const isTablet=windowWidth<960;
  const currentUser = useMemo(() => authAPI.getCurrentUser(), []);
  const outletGroups = useMemo(() => {
    const dynamicGroups = buildOutletGroupsFromVenues(venueRows);
    return dynamicGroups.length ? dynamicGroups : ADMIN_OUTLET_GROUPS;
  }, [venueRows]);
  const scopedOutletGroups = useMemo(
    () => getScopedOutletGroups(currentUser, outletGroups),
    [currentUser, outletGroups]
  );


  // ─── Master room list + any extra rooms found in reservations ───────────────
  const roomOptions = useMemo(() => {
    const scopedRooms = getScopedOutletRooms(currentUser, outletGroups);
    const scopedRoomSet = new Set(scopedRooms.map(canonicalOutletName));
    const fromReservations = reservations
      .map(r => canonicalOutletName(r.room))
      .filter(room => room && scopedRoomSet.has(canonicalOutletName(room)));
    const masterSet = new Set(scopedRooms);
    // Only add rooms from DB that aren't already in the master list
    const extras = Array.from(new Set(fromReservations))
      .filter(r => !masterSet.has(r))
      .sort((a, b) => a.localeCompare(b));
    return [...scopedRooms, ...extras];
  }, [currentUser, outletGroups, reservations]);

  const enrichedReservations = useMemo(
    () => reservations.map((reservation) => enrichReservation(reservation)),
    [reservations]
  );

  const refreshDashboardData = useCallback(async (silent = true) => {
    if (!silent) setLoading(true);
    try {
      const [reservationsData, statsData, venueData] = await Promise.all([
        fetchReservations(1, 9999),
        getReservationStats(),
        venueAPI.getAll({ include_archived: false, _t: Date.now() }).catch(() => []),
      ]);
      const rows = Array.isArray(reservationsData)
        ? reservationsData
        : Array.isArray(reservationsData?.data)
          ? reservationsData.data
          : [];
      setReservations(rows);
      if (statsData) setStats(statsData);
      setVenueRows(Array.isArray(venueData) ? venueData : []);
    } catch (err) {
      console.error("[Dashboard] Refresh error:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(()=>{
    refreshDashboardData(false);
  },[refreshDashboardData]);

  useEffect(()=>{
    const wsHost    = import.meta.env.VITE_WS_HOST    || "localhost";
    const wsPort    = import.meta.env.VITE_WS_PORT    || "6001";
    const protocol  = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl     = `${protocol}//${wsHost}:${wsPort}`;

    let ws           = null;
    let retryCount   = 0;
    const maxRetries = 3;
    const retryDelay = 5000;
    let wsLive       = false;

    const startPolling = () => {
      if (pollingRef.current) return;
      console.log("[Dashboard] Starting polling fallback (5s interval)");
      pollingRef.current = setInterval(() => refreshDashboardData(true), 5_000);
    };

    const stopPolling = () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };

    const connect = () => {
      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          wsLive = true;
          retryCount = 0;
          stopPolling();
        };

        ws.onclose = () => {
          wsLive = false;
          if (retryCount < maxRetries) {
            retryCount++;
            setTimeout(connect, retryDelay * Math.pow(2, retryCount - 1));
          } else {
            startPolling();
          }
        };

        ws.onerror = () => {
          if (retryCount >= maxRetries) startPolling();
        };

        ws.onmessage = event => {
          try {
            const data = JSON.parse(event.data);
            const updated = data?.payload?.reservation || data?.reservation;
            if (updated) {
              setReservations(prev => {
                const idx = prev.findIndex(r => r.id === updated.id);
                if (idx >= 0) { const arr = [...prev]; arr[idx] = updated; return arr; }
                return [...prev, updated];
              });
            }
          } catch (err) {
            console.error("[Dashboard WS] Parse error:", err);
          }
        };
      } catch (err) {
        console.error("[Dashboard] WebSocket init failed:", err);
        startPolling();
      }
    };

    connect();

    const fallbackTimer = setTimeout(() => {
      if (!wsLive) startPolling();
    }, 8_000);

    return () => {
      clearTimeout(fallbackTimer);
      stopPolling();
      if (ws) { ws.close(); ws = null; }
    };
  }, [refreshDashboardData]);

































  useEffect(()=>{
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, []);

  // ─── Filter logic (now includes room filter) ─────────────────────────────────
  useEffect(()=>{
    let filtered=[...enrichedReservations];
    const now = new Date();

    if(filterStatus!=="ALL"){
      filtered=filtered.filter((r)=>{
        const status=r.status?.toLowerCase();
        const state=getReservationState(r);
        if(filterStatus.toLowerCase()==="active"||filterStatus.toLowerCase()==="inactive"){
          return state===filterStatus.toLowerCase();
        }
        if(filterStatus.toLowerCase()==="approved"){
          return status==="approved"||status==="reserved";
        }
        return status===filterStatus.toLowerCase();
      });
    }

    // ← NEW: room filter
    if(filterRoom!=="ALL"){
      const children = resolveOutletChildren(filterRoom, venueRows);
      const childrenSet = new Set(children.map(canonicalOutletName));
      filtered=filtered.filter((r)=>{
        const resRoom = canonicalOutletName(r.room);
        return resRoom && (resRoom === filterRoom || childrenSet.has(resRoom));
      });
    }

    if(filterPriority!=="ALL"){
      filtered=filtered.filter((r)=>r._priority?.key===filterPriority.toLowerCase());
    }

    if(filterType!=="ALL"){
      filtered=filtered.filter((r)=>{
        const type=String(r.type || "").toLowerCase();
        if(filterType==="standalone") return type==="standalone" || String(r.table_number || "").toUpperCase()==="STANDALONE";
        if(filterType==="whole") return type==="whole";
        if(filterType==="individual") return type==="individual";
        return true;
      });
    }

    if(quickFilter!=="ALL"){
      filtered=filtered.filter((r)=>{
        const eventAt = r._eventAt;
        const status = String(r.status || "").toLowerCase();
        const days = eventAt ? daysBetween(now, eventAt) : null;
        if(quickFilter==="today") return days===0;
        if(quickFilter==="tomorrow") return days===1;
        if(quickFilter==="week") return days!==null && days>=0 && days<=7;
        if(quickFilter==="awaiting") return status==="pending";
        if(quickFilter==="urgent") return r._priority?.key === "urgent";
        return true;
      });
    }

    if(search.trim()){
      const q=search.toLowerCase();
      filtered=filtered.filter((r)=>
        r.name?.toLowerCase().includes(q)||
        r.email?.toLowerCase().includes(q)||
        String(r.phone || "").toLowerCase().includes(q)||
        String(r.room || "").toLowerCase().includes(q)||
        r.reference_code?.toLowerCase().includes(q)||
        (q==="standalone"&&(String(r.table_number||"").toUpperCase()==="STANDALONE"||r.type==="standalone"))
      );
    }

    filtered.sort((a,b)=>{
      const statusRank = (r) => String(r.status || "").toLowerCase()==="pending" ? 0 : 1;
      const eventTime = (r) => r._eventAt ? r._eventAt.getTime() : Number.MAX_SAFE_INTEGER;
      const submittedTime = (r) => r._submittedAt ? r._submittedAt.getTime() : 0;
      if(sortBy==="smart"){
        return statusRank(a)-statusRank(b)
          || (a._priority?.rank ?? 9)-(b._priority?.rank ?? 9)
          || eventTime(a)-eventTime(b)
          || submittedTime(a)-submittedTime(b);
      }
      if(sortBy==="event_asc") return eventTime(a)-eventTime(b);
      if(sortBy==="oldest_waiting") return submittedTime(a)-submittedTime(b);
      if(sortBy==="newest_request") return submittedTime(b)-submittedTime(a);
      if(sortBy==="priority") return (a._priority?.rank ?? 9)-(b._priority?.rank ?? 9);
      if(sortBy==="status") return String(a.status || "").localeCompare(String(b.status || ""));
      if(sortBy==="room") return String(a.room || "").localeCompare(String(b.room || ""));
      if(sortBy==="guests") return Number(b.guests_count || 0)-Number(a.guests_count || 0);
      return 0;
    });

    setFilteredReservations(filtered);
    const filterSignature = JSON.stringify([filterStatus, filterRoom, filterPriority, filterType, quickFilter, search, sortBy]);
    const filterChanged = filterSignatureRef.current !== filterSignature;
    filterSignatureRef.current = filterSignature;
    setPagination((p) => {
      const lastPage = Math.max(1, Math.ceil(filtered.length / p.rowsPerPage));
      return {
        ...p,
        lastPage,
        totalItems: filtered.length,
        currentPage: filterChanged ? 1 : Math.min(p.currentPage, lastPage),
      };
    });
  },[enrichedReservations,filterStatus,filterRoom,filterPriority,filterType,quickFilter,search,sortBy]);

  useEffect(()=>{
    const total    = reservations.length;
    const pending  = reservations.filter(r=>r.status?.toLowerCase()==="pending").length;
    const approved = reservations.filter(r=>r.status?.toLowerCase()==="approved"||r.status?.toLowerCase()==="reserved").length;
    const rejected = reservations.filter(r=>r.status?.toLowerCase()==="rejected").length;
    const active = reservations.filter(r=>getReservationState(r)==="active").length;
    const inactive = reservations.filter(r=>getReservationState(r)==="inactive").length;
    setStats({total,pending,approved,rejected,active,inactive});
  },[reservations]);

  const operationalStats = useMemo(() => {
    const now = new Date();
    return enrichedReservations.reduce((acc, reservation) => {
      const days = reservation._eventAt ? daysBetween(now, reservation._eventAt) : null;
      const status = String(reservation.status || "").toLowerCase();
      if (days === 0) acc.today += 1;
      if (days !== null && days >= 0 && days <= 7) acc.week += 1;
      if (reservation._priority?.key === "urgent") acc.urgent += 1;
      if (reservation._priority?.key === "overdue") acc.overdue += 1;
      if (status === "pending") acc.awaiting += 1;
      if (reservation._notificationStatus === "Failed") acc.notificationIssues += 1;
      return acc;
    }, { today:0, week:0, urgent:0, overdue:0, awaiting:0, notificationIssues:0 });
  }, [enrichedReservations]);

  const handlePageChange = (page) => {
    if (page < 1 || page > pagination.lastPage) return;
    setPagination((p) => ({ ...p, currentPage: page }));
  };

  const handleRowsChange = (newRows) => {
    setPagination((p) => ({
      ...p,
      rowsPerPage: newRows,
      currentPage: 1,
      lastPage: Math.max(1, Math.ceil(filteredReservations.length / newRows)),
    }));
  };

  const handleSelectReservation = (reservationId) => {
    if (!canDeleteReservations) return;
    setSelectedReservations(prev => {
      const newSet = new Set(prev);
      if (newSet.has(reservationId)) newSet.delete(reservationId);
      else newSet.add(reservationId);
      return newSet;
    });
  };

  const handleDeleteSelected = async () => {
    if (!canDeleteReservations) {
      setToast({ message: "You are not authorized to delete reservations.", type: "error" });
      return;
    }
    if (selectedReservations.size === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedReservations.size} selected reservation(s)? This action cannot be undone.`)) return;

    try {
      const toDelete = reservations.filter(r => selectedReservations.has(r.id));

      const deletePromises = Array.from(selectedReservations).map(async (reservationId) => {
        const token = localStorage.getItem("admin_token");
        const response = await fetch(`${API_BASE_URL}/admin/reservations/${reservationId}`, {
          method: "DELETE",
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        return { id: reservationId, ok: response.ok };
      });

      const results = await Promise.all(deletePromises);
      const successIds = new Set(results.filter(r => r.ok).map(r => r.id));
      const failedCount = results.length - successIds.size;

      if (successIds.size > 0) {
        setReservations(prev => prev.filter(r => !successIds.has(r.id)));
        toDelete
          .filter(r => successIds.has(r.id))
          .forEach(r => optimisticSeatUpdate(r, "available"));
        setToast({ message: `Successfully deleted ${successIds.size} reservation(s)`, type: "success" });
      }

      if (failedCount > 0) {
        setToast({ message: `Failed to delete ${failedCount} reservation(s)`, type: "error" });
      }

      setSelectedReservations(new Set());
    } catch (error) {
      console.error("[Dashboard] Failed to delete reservations:", error);
      setToast({ message: "Failed to delete reservations", type: "error" });
    }
  };

  const handleApprove = async (reservation) => {
    try {
      const result = await approveReservation(reservation.db_id);
      if (result.success) {
        const updatedFields = {
          status: result.status || "reserved",
          reservation_state: "active",
          previous_status: result.previous_status || reservation.status,
          status_last_changed_at: result.status_last_changed_at || new Date().toISOString(),
          transaction_history: result.transaction_history || reservation.transaction_history
        };
        setReservations(prev =>
          prev.map(r => r.id === reservation.id ? {
            ...r,
            ...updatedFields
          } : r)
        );
        setSelectedReservation(prev => prev && prev.id === reservation.id ? {
          ...prev,
          ...updatedFields
        } : prev);
        optimisticSeatUpdate(reservation, "reserved");
        setToast({ message: `Approved! Confirmation email sent to ${reservation.email}.`, type: "success" });
      } else {
        setToast({ message: result.message || "Failed to approve", type: "error" });
      }
    } catch {
      setToast({ message: "Error approving reservation", type: "error" });
    }
  };

  const handleReject = async (reservation, reason) => {
    try {
      const result = await rejectReservation(reservation.db_id, reason);
      if (result.success) {
        const now = new Date().toISOString();
        const updatedFields = {
          status: "rejected",
          reservation_state: "inactive",
          previous_status: reservation.status,
          status_last_changed_at: result.status_last_changed_at || now,
          rejected_at: result.rejected_at || now,
          rejection_reason: reason,
          transaction_history: result.transaction_history || reservation.transaction_history
        };
        setReservations(prev =>
          prev.map(r => r.id === reservation.id ? {
            ...r,
            ...updatedFields
          } : r)
        );
        setSelectedReservation(prev => prev && prev.id === reservation.id ? {
          ...prev,
          ...updatedFields
        } : prev);
        optimisticSeatUpdate(reservation, "available");
        setToast({ message: `Rejected. Notification email sent to ${reservation.email}.`, type: "success" });
      } else {
        setToast({ message: result.message || "Failed to reject", type: "error" });
      }
    } catch {
      setToast({ message: "Error rejecting reservation", type: "error" });
    }
  };

  const handleRevert = async (reservation) => {
    try {
      const result = await revertReservation(reservation.db_id);
      if (result.success) {
        const now = new Date().toISOString();
        const updatedFields = {
          status: "pending",
          reservation_state: "active",
          previous_status: reservation.status,
          status_last_changed_at: result.status_last_changed_at || now,
          reverted_at: result.reverted_at || now,
          transaction_history: result.transaction_history || reservation.transaction_history
        };
        setReservations(prev =>
          prev.map(r => r.id === reservation.id ? {
            ...r,
            ...updatedFields
          } : r)
        );
        setSelectedReservation(prev => prev && prev.id === reservation.id ? {
          ...prev,
          ...updatedFields
        } : prev);
        optimisticSeatUpdate(reservation, "pending");
        setToast({ message: "Reservation reverted to pending review.", type: "success" });
      } else {
        setToast({ message: result.message || "Failed to revert reservation", type: "error" });
      }
    } catch {
      setToast({ message: "Error reverting reservation", type: "error" });
    }
  };

  const handleCancel = async (reservation, reason) => {
    try {
      const result = await cancelReservation(reservation.db_id || reservation.id, reason);
      if (result.success) {
        const now = new Date().toISOString();
        const updatedFields = {
          status: "cancelled",
          reservation_state: "inactive",
          previous_status: reservation.status,
          status_last_changed_at: result.status_last_changed_at || now,
          cancelled_at: result.cancelled_at || now,
          cancellation_reason: reason,
          transaction_history: result.transaction_history || reservation.transaction_history
        };
        setReservations(prev =>
          prev.map(r => r.id === reservation.id ? {
            ...r,
            ...updatedFields
          } : r)
        );
        setSelectedReservation(prev => prev && prev.id === reservation.id ? {
          ...prev,
          ...updatedFields
        } : prev);
        optimisticSeatUpdate(reservation, "available");
        setToast({ message: `Reservation cancelled. Notification email sent to ${reservation.email}.`, type: "success" });
      } else {
        setToast({ message: result.message || "Failed to cancel reservation", type: "error" });
      }
    } catch {
      setToast({ message: "Error cancelling reservation", type: "error" });
    }
  };

  const handleUpdateDetails = async (reservation, payload) => {
    try {
      const result = await updateReservation(reservation.db_id || reservation.id, payload);
      if (result.success) {
        const updated = result.reservation || { ...reservation, ...payload };
        setReservations(prev =>
          prev.map(r => r.id === reservation.id ? {
            ...r,
            ...updated,
            id: r.id,
            db_id: r.db_id || updated.id,
            transaction_history: result.transaction_history || updated.transaction_history || r.transaction_history,
          } : r)
        );
        setSelectedReservation(prev => prev && prev.id === reservation.id ? {
          ...prev,
          ...updated,
          id: prev.id,
          db_id: prev.db_id || updated.id,
          transaction_history: result.transaction_history || updated.transaction_history || prev.transaction_history,
        } : prev);
        setToast({ message: "Reservation details updated.", type: "success" });
        return { success: true };
      }
      setToast({ message: result.message || "Failed to update reservation details", type: "error" });
      return { success: false, message: result.message };
    } catch (error) {
      setToast({ message: "Error updating reservation details", type: "error" });
      return { success: false, message: error.message };
    }
  };

  const handleFocusClick = (type) => {
    let isCurrentlyActive = false;
    if (type === "PENDING") isCurrentlyActive = filterStatus === "PENDING";
    if (type === "urgent") isCurrentlyActive = quickFilter === "urgent";
    if (type === "overdue") isCurrentlyActive = filterPriority === "overdue";
    if (type === "today") isCurrentlyActive = quickFilter === "today";
    if (type === "APPROVED") isCurrentlyActive = filterStatus === "APPROVED";

    setFilterStatus("ALL");
    setFilterPriority("ALL");
    setFilterType("ALL");
    setQuickFilter("ALL");

    if (isCurrentlyActive) return;

    if (type === "PENDING") setFilterStatus("PENDING");
    if (type === "urgent") setQuickFilter("urgent");
    if (type === "overdue") setFilterPriority("overdue");
    if (type === "today") setQuickFilter("today");
    if (type === "APPROVED") setFilterStatus("APPROVED");
  };

  const statCards=[
    {label:"Total",    count:stats.total,    filter:"ALL",      color:C.gold,               bg:C.goldFaint,           border:C.borderAccent              },
    {label:"Active",   count:stats.active,   filter:"ACTIVE",   color:C.green,              bg:C.greenFaint,          border:C.greenBorder               },
    {label:"Inactive", count:stats.inactive, filter:"INACTIVE", color:C.textSecondary,      bg:"rgba(0,0,0,0.04)",    border:C.borderDefault             },
    {label:"Pending",  count:stats.pending,  filter:"PENDING",  color:C.badgePending.color,  bg:C.statusNote.pending,  border:C.statusNoteBorder.pending  },
    {label:"Reserved", count:stats.approved, filter:"APPROVED", color:C.badgeApproved.color, bg:C.greenFaint, border:C.greenBorder },
    {label:"Rejected", count:stats.rejected, filter:"REJECTED", color:C.badgeRejected.color, bg:C.statusNote.rejected, border:C.statusNoteBorder.rejected },
  ];

  const pagedReservations=filteredReservations.slice(
    (pagination.currentPage-1)*pagination.rowsPerPage,
    pagination.currentPage*pagination.rowsPerPage
  );

  // Whether any filter is active (for "clear all" affordance)
  const hasActiveFilters = filterStatus !== "ALL" || filterRoom !== "ALL" || filterPriority !== "ALL" || filterType !== "ALL" || quickFilter !== "ALL" || search.trim() !== "";

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin');
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin       { to { transform: rotate(360deg); } }
        @keyframes fadeUp     { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
        @keyframes modalIn    { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes shimmer    { 0% { background-position:-200% 0 } 100% { background-position:200% 0 } }
        @keyframes drawerSlideIn { from { transform:translateX(100%); } to { transform:translateX(0); } }
        @keyframes dropdownIn { from { opacity:0; transform:translateY(-6px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12); border-radius:4px; }
      `}</style>

      <div style={{height:"100vh",overflow:"hidden",fontFamily:F.body,background:C.pageBg,color:C.textPrimary}}>
        <AdminNavbar onLogout={handleLogout}/>

        <div style={{display:"flex",height:"calc(100vh - 60px)",minHeight:0}}>
          <Sidebar
            isOpen={sidebarOpen}
            onToggle={()=>setSidebarOpen(!sidebarOpen)}
            activeNav="reservations"
          />

          <div style={{flex:1,minWidth:0,height:"calc(100vh - 60px)",background:C.pageBg,overflow:"auto"}}>

            {/* ── Top navbar bar ── */}
            <div style={{
              position:"sticky",top:0,zIndex:100,
              background:C.navBg,
              backdropFilter:"blur(20px)",WebkitBackdropFilter:"blur(20px)",
              borderBottom:`1px solid ${C.navBorder}`,
              padding:isMobile?"10px 16px":"0 28px",
              height:isMobile?"auto":52,
              display:"none",alignItems:"center",
              justifyContent:"space-between",
              gap:10,flexWrap:isMobile?"wrap":"nowrap",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontFamily:F.label,fontSize:9,letterSpacing:"0.20em",color:C.gold,fontWeight:700,textTransform:"uppercase"}}>Admin</span>
                <span style={{color:C.textTertiary,fontSize:11}}>·</span>
                <span style={{fontFamily:F.label,fontSize:9,letterSpacing:"0.14em",color:C.textSecondary,fontWeight:600,textTransform:"uppercase"}}>Reservation Management</span>
              </div>

              {/* ── Search + Room filter in navbar ── */}
              <div style={{display:"none",alignItems:"center",gap:8,flexWrap:isMobile?"wrap":"nowrap"}}>
                {/* Room filter dropdown */}
                <RoomFilterDropdown
                  rooms={roomOptions}
                  venues={venueRows}
                  selectedRoom={filterRoom}
                  onSelect={(room) => setFilterRoom(room)}
                  isMobile={isMobile}
                />

                {/* Search */}
                <div style={{position:"relative"}}>
                  <svg style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}
                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke={searchFocused?C.gold:C.textTertiary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    style={{
                      padding:"7px 12px 7px 28px",
                      background:C.surfaceInput,
                      border:`1.5px solid ${searchFocused?C.borderAccent:C.borderDefault}`,
                      borderRadius:8,color:C.textPrimary,
                      fontFamily:F.body,fontSize:12,
                      width:isMobile?"100%":220,outline:"none",
                      transition:"border-color 0.18s,box-shadow 0.18s",
                      boxShadow:searchFocused?C.inputFocusShadow:"none",
                    }}
                    placeholder="Search name, email, ref or standalone…"
                    value={search}
                    onChange={(e)=>setSearch(e.target.value)}
                    onFocus={()=>setSearchFocused(true)}
                    onBlur={()=>setSearchFocused(false)}
                  />
                </div>
              </div>
            </div>

            <div style={{padding:isMobile?"22px 16px 30px":isTablet?"26px 22px 36px":"30px 32px 42px",animation:"fadeUp 0.28s ease"}}>

              <AdminPageHeader
                eyebrow="Reservations"
                title="Reservation Dashboard"
                description="Manage and review reservation requests, pending actions, near events, and delayed responses."
                C={C}
                F={F}
                compact={isMobile || isTablet}
              />

              {/* ── Stat cards ── */}
              <div style={{
                background:C.cardBg,
                border:`1px solid ${C.cardBorder}`,
                borderRadius:12,
                padding:isMobile?"12px":"14px 16px",
                marginBottom:isMobile?16:18,
                boxShadow:"0 1px 4px rgba(24,20,14,0.025)",
                display:"grid",
                gap:12,
              }}>
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
                  <div>
                    <div style={{fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.18em",textTransform:"uppercase",color:C.gold,marginBottom:4}}>
                      Queue Priorities
                    </div>
                    <div style={{fontSize:12,color:C.textSecondary}}>
                      Prioritize pending requests, near events, and delayed responses.
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:7,flexWrap:"wrap"}}>
                    <InlineMetric label="Total" value={loading?"--":stats.total} tone="gold" />
                    <InlineMetric label="Active" value={loading?"--":stats.active} tone="green" />
                    <InlineMetric label="Inactive" value={loading?"--":stats.inactive} tone="muted" />
                    <InlineMetric label="Week" value={loading?"--":operationalStats.week} tone="gold" />
                    <InlineMetric label="Notify" value={loading?"--":operationalStats.notificationIssues} tone={operationalStats.notificationIssues ? "red" : "green"} />
                  </div>
                </div>

                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":isTablet?"repeat(2,1fr)":"repeat(5,minmax(0,1fr))",gap:10}}>
                  <QueueMetric label="Pending" value={loading?"--":stats.pending} helper="awaiting action" tone="gold" active={filterStatus==="PENDING"} onClick={()=>handleFocusClick("PENDING")} isMobile={isMobile} />
                  <QueueMetric label="Urgent" value={loading?"--":operationalStats.urgent} helper="within 24h" tone="red" active={quickFilter==="urgent"} onClick={()=>handleFocusClick("urgent")} isMobile={isMobile} />
                  <QueueMetric label="Overdue" value={loading?"--":operationalStats.overdue} helper="pending over 24h" tone="red" active={filterPriority==="overdue"} onClick={()=>handleFocusClick("overdue")} isMobile={isMobile} />
                  <QueueMetric label="Today" value={loading?"--":operationalStats.today} helper="events today" tone="green" active={quickFilter==="today"} onClick={()=>handleFocusClick("today")} isMobile={isMobile} />
                  <QueueMetric label="Reserved" value={loading?"--":stats.approved} helper="confirmed" tone="green" active={filterStatus==="APPROVED"} onClick={()=>handleFocusClick("APPROVED")} isMobile={isMobile} />
                </div>
              </div>

              <div style={{display:"none",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(3,1fr)",gap:isMobile?10:12,marginBottom:isMobile?18:22}}>
                {statCards.map(({label,count,filter,color,bg,border})=>{
                  const active=filterStatus===filter;
                  return(
                    <button key={filter} onClick={()=>setFilterStatus(filter)}
                      style={{
                        background:active?bg:C.cardBg,
                        border:`1px solid ${active?border:C.cardBorder}`,
                        borderRadius:10,
                        padding:isMobile?"14px 12px":"18px 20px",
                        textAlign:"left",cursor:"pointer",
                        transition:"all 0.18s ease",outline:"none",
                        boxShadow:active?`0 1px 5px ${color}12`:"0 1px 3px rgba(24,20,14,0.025)",
                        transform:active?"translateY(-1px)":"translateY(0)",
                      }}
                      onMouseEnter={(e)=>{if(!active){e.currentTarget.style.borderColor=border;e.currentTarget.style.transform="translateY(-1px)";e.currentTarget.style.boxShadow=`0 2px 7px ${color}10`;}}}
                      onMouseLeave={(e)=>{if(!active){e.currentTarget.style.borderColor=C.cardBorder;e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 1px 3px rgba(24,20,14,0.025)";}}}
                    >
                      <div style={{fontFamily:F.display,fontSize:isMobile?28:36,fontWeight:650,color:color,lineHeight:1,marginBottom:isMobile?6:8,letterSpacing:0}}>
                        {loading?"—":count}
                      </div>
                      <div style={{fontFamily:F.label,fontSize:9,color:active?color:C.textTertiary,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.14em",transition:"color 0.18s"}}>
                        {label}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ── Table card ── */}
              <div style={{display:"none",gridTemplateColumns:isMobile?"repeat(2,1fr)":isTablet?"repeat(3,1fr)":"repeat(6,1fr)",gap:10,marginBottom:isMobile?18:22}}>
                <OperationalMetricCard label="Awaiting" value={operationalStats.awaiting} helper="Need admin response" tone="gold" onClick={()=>{setQuickFilter("awaiting");setFilterStatus("PENDING");}} />
                <OperationalMetricCard label="Overdue" value={operationalStats.overdue} helper="Pending over 24h" tone="red" onClick={()=>setFilterPriority("overdue")} />
                <OperationalMetricCard label="Urgent" value={operationalStats.urgent} helper="Within 24 hours" tone="red" onClick={()=>setQuickFilter("urgent")} />
                <OperationalMetricCard label="Today" value={operationalStats.today} helper="Events today" tone="green" onClick={()=>setQuickFilter("today")} />
                <OperationalMetricCard label="This Week" value={operationalStats.week} helper="Upcoming schedule" tone="gold" onClick={()=>setQuickFilter("week")} />
                <OperationalMetricCard label="Notifications" value={operationalStats.notificationIssues} helper="Delivery issues" tone={operationalStats.notificationIssues ? "red" : "green"} />
              </div>

              <div style={{background:C.cardBg,borderRadius:12,border:`1px solid ${C.cardBorder}`,overflow:"visible",boxShadow:"0 1px 4px rgba(24,20,14,0.03)"}}>

                {/* Table toolbar */}
                <div style={{
                  padding:isMobile?"12px 14px":"14px 22px",
                  borderBottom:`1px solid ${C.divider}`,
                  display:"flex",alignItems:"center",
                  justifyContent:"space-between",
                  flexWrap:isMobile?"wrap":"nowrap",
                  gap:10,
                  background:C.headerGradient,
                }}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    <div style={{fontFamily:F.label,fontSize:9,letterSpacing:"0.26em",color:C.gold,fontWeight:700,textTransform:"uppercase"}}>
                      {filterStatus === "PENDING" ? "Pending Reservations" :
                       quickFilter === "urgent" ? "Urgent Reservations" :
                       filterPriority === "overdue" ? "Overdue Responses" :
                       quickFilter === "today" ? "Today's Events" :
                       filterStatus === "APPROVED" ? "Reserved Queue" : "All Reservations"}
                    </div>
                    <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",padding:"2px 8px",background:C.goldFaint,border:`1px solid ${C.borderAccent}`,borderRadius:20,fontFamily:F.label,fontSize:9,fontWeight:700,color:C.gold,letterSpacing:"0.10em"}}>
                      {loading?"--":filteredReservations.length}
                    </span>

                    {/* Active room filter pill */}
                    {filterRoom !== "ALL" && (
                      <span style={{
                        display:"inline-flex",alignItems:"center",gap:5,
                        padding:"2px 8px 2px 8px",
                        background:"rgba(140,107,42,0.06)",
                        border:`1px solid ${C.gold}44`,
                        borderRadius:20,
                        fontFamily:F.label,fontSize:9,fontWeight:700,
                        letterSpacing:"0.08em",
                        color:C.gold,
                        maxWidth:180,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                      }}>
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                          <polyline points="9 22 9 12 15 12 15 22"/>
                        </svg>
                        {filterRoom}
                        <button
                          onClick={() => setFilterRoom("ALL")}
                          style={{background:"none",border:"none",padding:0,cursor:"pointer",display:"inline-flex",alignItems:"center",color:C.gold,opacity:0.7,marginLeft:1}}
                          title="Clear room filter"
                        >
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </span>
                    )}

                    {canDeleteReservations && selectedReservations.size > 0 && (
                      <button
                        onClick={handleDeleteSelected}
                        style={{padding:"4px 10px",background:C.red,color:"#fff",border:"none",borderRadius:6,fontFamily:F.label,fontSize:9,fontWeight:700,cursor:"pointer",transition:"all 0.15s",letterSpacing:"0.10em",textTransform:"uppercase"}}
                        onMouseEnter={(e)=>{e.currentTarget.style.background="#C04040";}}
                        onMouseLeave={(e)=>{e.currentTarget.style.background=C.red;}}
                      >
                        Delete ({selectedReservations.size})
                      </button>
                    )}

                    {filterStatus!=="ALL"&&(
                      <button onClick={()=>setFilterStatus("ALL")}
                        style={{background:"transparent",border:`1px solid ${C.borderDefault}`,borderRadius:6,padding:"3px 9px",fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",color:C.textSecondary,cursor:"pointer",transition:"all 0.15s",display:"flex",alignItems:"center",gap:5}}
                        onMouseEnter={(e)=>{e.currentTarget.style.borderColor=C.borderAccent;e.currentTarget.style.color=C.gold;}}
                        onMouseLeave={(e)=>{e.currentTarget.style.borderColor=C.borderDefault;e.currentTarget.style.color=C.textSecondary;}}
                      >
                        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                        Clear status
                      </button>
                    )}
                  </div>

                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {canDeleteReservations && <input
                      type="checkbox"
                      checked={selectedReservations.size === filteredReservations.length && filteredReservations.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) setSelectedReservations(new Set(filteredReservations.map((r) => r.id)));
                        else setSelectedReservations(new Set());
                      }}
                      style={{width:16,height:16,border:`1px solid ${C.borderDefault}`,borderRadius:4,backgroundColor:C.surfaceBase,cursor:"pointer"}}
                    />}
                    {canDeleteReservations && <span style={{fontSize:11,color:C.textSecondary,fontFamily:F.body}}>Select All</span>}
                  </div>
                </div>

                <div style={{padding:isMobile?"12px 14px":"14px 22px",borderBottom:`1px solid ${C.divider}`,background:C.surfaceBase,display:"grid",gap:12}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    {[
                      ["ALL","All"],
                      ["today","Today"],
                      ["tomorrow","Tomorrow"],
                      ["week","This Week"],
                      ["urgent","Urgent"],
                      ["awaiting","Awaiting Response"],
                    ].map(([value,label])=>(
                      <button
                        key={value}
                        type="button"
                        onClick={()=>setQuickFilter(value)}
                        style={{
                          padding:"6px 10px",
                          borderRadius:999,
                          border:`1px solid ${quickFilter===value?C.borderAccent:C.borderDefault}`,
                          background:quickFilter===value?C.goldFaint:C.surfaceBase,
                          color:quickFilter===value?C.gold:C.textSecondary,
                          fontFamily:F.label,
                          fontSize:9,
                          fontWeight:800,
                          letterSpacing:"0.11em",
                          textTransform:"uppercase",
                          cursor:"pointer",
                        }}
                      >
                        {label}
                      </button>
                    ))}
                    <div style={{position:"relative",marginLeft:isMobile?0:"auto",flex:isMobile?"1 1 100%":"1 1 240px",maxWidth:isMobile?"100%":340}}>
                      <svg style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}
                        width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke={searchFocused?C.gold:C.textTertiary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                      </svg>
                      <input
                        style={{
                          padding:"8px 12px 8px 30px",
                          background:C.surfaceInput,
                          border:`1px solid ${searchFocused?C.borderAccent:C.borderDefault}`,
                          borderRadius:8,
                          color:C.textPrimary,
                          fontFamily:F.body,
                          fontSize:12,
                          width:"100%",
                          outline:"none",
                          transition:"border-color 0.18s,box-shadow 0.18s",
                          boxShadow:searchFocused?C.inputFocusShadow:"none",
                        }}
                        placeholder="Search guest, contact, room, or reference"
                        value={search}
                        onChange={(e)=>setSearch(e.target.value)}
                        onFocus={()=>setSearchFocused(true)}
                        onBlur={()=>setSearchFocused(false)}
                      />
                    </div>
                  </div>
                  <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":isTablet?"repeat(2,1fr)":"repeat(6, minmax(140px,1fr))",gap:10,alignItems:"end"}}>
                    <label style={{display:"grid",gap:5}}>
                      <span style={{fontFamily:F.label,fontSize:8.5,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Room</span>
                      <RoomFilterDropdown
                        rooms={roomOptions}
                        venues={venueRows}
                        selectedRoom={filterRoom}
                        onSelect={(room) => setFilterRoom(room)}
                        isMobile={isMobile}
                      />
                    </label>
                    <label style={{display:"grid",gap:5}}>
                      <span style={{fontFamily:F.label,fontSize:8.5,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Status</span>
                      <select value={filterStatus} onChange={(e)=>setFilterStatus(e.target.value)} style={{padding:"9px 10px",border:`1px solid ${C.borderDefault}`,borderRadius:8,background:C.surfaceInput,color:C.textPrimary,fontSize:12}}>
                        <option value="ALL">All statuses</option>
                        <option value="PENDING">Pending</option>
                        <option value="APPROVED">Reserved</option>
                        <option value="REJECTED">Rejected</option>
                        <option value="ACTIVE">Active</option>
                        <option value="INACTIVE">Inactive</option>
                      </select>
                    </label>
                    <label style={{display:"grid",gap:5}}>
                      <span style={{fontFamily:F.label,fontSize:8.5,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Priority</span>
                      <select value={filterPriority} onChange={(e)=>setFilterPriority(e.target.value)} style={{padding:"9px 10px",border:`1px solid ${C.borderDefault}`,borderRadius:8,background:C.surfaceInput,color:C.textPrimary,fontSize:12}}>
                        <option value="ALL">All priorities</option>
                        <option value="overdue">Overdue response</option>
                        <option value="urgent">Urgent</option>
                        <option value="soon">Soon</option>
                        <option value="upcoming">Upcoming</option>
                        <option value="closed">Closed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="normal">Normal</option>
                      </select>
                    </label>
                    <label style={{display:"grid",gap:5}}>
                      <span style={{fontFamily:F.label,fontSize:8.5,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Type</span>
                      <select value={filterType} onChange={(e)=>setFilterType(e.target.value)} style={{padding:"9px 10px",border:`1px solid ${C.borderDefault}`,borderRadius:8,background:C.surfaceInput,color:C.textPrimary,fontSize:12}}>
                        <option value="ALL">All types</option>
                        <option value="whole">Whole table</option>
                        <option value="individual">Individual seat</option>
                        <option value="standalone">Standalone</option>
                      </select>
                    </label>
                    <label style={{display:"grid",gap:5}}>
                      <span style={{fontFamily:F.label,fontSize:8.5,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>Queue Sort</span>
                      <select value={sortBy} onChange={(e)=>setSortBy(e.target.value)} style={{padding:"9px 10px",border:`1px solid ${C.borderDefault}`,borderRadius:8,background:C.surfaceInput,color:C.textPrimary,fontSize:12}}>
                        <option value="smart">Smart priority</option>
                        <option value="event_asc">Event soonest</option>
                        <option value="oldest_waiting">Oldest request</option>
                        <option value="newest_request">Newest request</option>
                        <option value="guests">Guest count</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={()=>{setFilterStatus("ALL");setFilterRoom("ALL");setFilterPriority("ALL");setFilterType("ALL");setQuickFilter("ALL");setSearch("");setSortBy("smart");}}
                      style={{alignSelf:"end",minHeight:37,border:`1px solid ${C.borderDefault}`,borderRadius:8,background:C.surfaceBase,color:C.textSecondary,fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer"}}
                    >
                      Reset Queue
                    </button>
                  </div>
                </div>

                {/* Reservation rows */}
                <div style={{padding:isMobile?"10px":"12px 18px",display:"flex",flexDirection:"column",gap:8}}>
                  {loading?(
                    Array.from({length:5}).map((_,i)=>(
                      <div key={i} style={{height:74,borderRadius:8,background:"linear-gradient(90deg,#F0EDE6 25%,#E8E4DC 50%,#F0EDE6 75%)",backgroundSize:"200% 100%",animation:`shimmer 1.4s ease infinite`,animationDelay:`${i*0.08}s`,border:`1px solid rgba(0,0,0,0.04)`}}/>
                    ))
                  ):pagedReservations.length===0?(
                    <div style={{padding:"44px 24px",textAlign:"center"}}>
                      <div style={{fontFamily:F.label,fontSize:11,fontWeight:700,letterSpacing:"0.16em",color:C.textSecondary,textTransform:"uppercase"}}>No Reservations Found</div>
                      <div style={{fontFamily:F.body,fontSize:12,color:C.textTertiary,marginTop:6}}>
                        {filterRoom !== "ALL"
                          ? `No reservations found in "${filterRoom}"${filterStatus !== "ALL" ? ` with status "${filterStatus.toLowerCase()}"` : ""}`
                          : search ? "Try adjusting your search" : "No reservations match the current filter"}
                      </div>
                      {hasActiveFilters && (
                        <button
                          onClick={() => { setFilterStatus("ALL"); setFilterRoom("ALL"); setFilterPriority("ALL"); setFilterType("ALL"); setQuickFilter("ALL"); setSearch(""); setSortBy("smart"); }}
                          style={{
                            marginTop:12,padding:"7px 14px",background:"transparent",
                            border:`1px solid ${C.borderAccent}`,borderRadius:7,
                            fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.12em",
                            textTransform:"uppercase",color:C.gold,cursor:"pointer",transition:"all 0.15s",
                          }}
                          onMouseEnter={(e)=>{e.currentTarget.style.background=C.goldFaint;}}
                          onMouseLeave={(e)=>{e.currentTarget.style.background="transparent";}}
                        >
                          Clear All Filters
                        </button>
                      )}
                    </div>
                  ):(
                    pagedReservations.map((reservation,idx)=>{
                      const isStandaloneCard =
                        String(reservation.table_number || "").toUpperCase() === "STANDALONE" ||
                        reservation.type === "standalone" ||
                        reservation.is_standalone === 1 ||
                        reservation.is_standalone === true;

                      const status = (reservation.status || "").toLowerCase();
                      const seatTextColor  = getSeatStatusColor(status);
                      const seatTextWeight = getSeatStatusWeight(status);

                      return (
                        <div
                          key={reservation.id}
                          style={{
                            background:C.surfaceBase,
                            border:`1px solid ${C.borderDefault}`,
                            borderRadius:8,
                            padding:isMobile?"12px":"14px 18px",
                            transition:"all 0.16s ease",
                            animation:`fadeUp 0.22s ease both`,
                            animationDelay:`${idx*0.025}s`,
                          }}
                          onMouseEnter={(e)=>{e.currentTarget.style.borderColor=C.borderAccent;e.currentTarget.style.boxShadow=`0 3px 12px rgba(140,107,42,0.10)`;e.currentTarget.style.transform="translateY(-1px)";}}
                          onMouseLeave={(e)=>{e.currentTarget.style.borderColor=C.borderDefault;e.currentTarget.style.boxShadow="none";e.currentTarget.style.transform="translateY(0)";}}
                        >
                          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:10,flexWrap:isMobile?"wrap":"nowrap"}}>
                            <div style={{display:"flex",alignItems:"flex-start",gap:10,flex:1,minWidth:0}}>
                              {canDeleteReservations && <input
                                type="checkbox"
                                checked={selectedReservations.has(reservation.id)}
                                onChange={(e) => { e.stopPropagation(); handleSelectReservation(reservation.id); }}
                                onClick={(e) => e.stopPropagation()}
                                style={{width:16,height:16,border:`1px solid ${C.borderDefault}`,borderRadius:4,backgroundColor:C.surfaceBase,cursor:"pointer",marginTop:2,flexShrink:0}}
                              />}
                              <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>{setSelectedReservation(reservation);setShowModal(true);}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:5,flexWrap:"wrap"}}>
                                  <div style={{fontFamily:F.body,fontSize:14,fontWeight:600,color:C.textPrimary}}>{reservation.name||"-"}</div>
                                  {reservation.event_date&&(
                                    <span style={{fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",color:C.textTertiary,padding:"2px 6px",background:"rgba(0,0,0,0.04)",border:`1px solid rgba(0,0,0,0.06)`,borderRadius:4,flexShrink:0}}>
                                      {new Date(reservation.event_date+"T00:00:00").toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"})}
                                    </span>
                                  )}
                                  {reservation.event_time&&(
                                    <span style={{fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",color:C.gold,padding:"2px 6px",background:C.goldFaint,border:`1px solid ${C.borderAccent}`,borderRadius:4,flexShrink:0}}>
                                      {reservation.event_time}
                                    </span>
                                  )}
                                  {isStandaloneCard&&(
                                    <span style={{fontFamily:F.label,fontSize:8,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",color:C.gold,padding:"2px 7px",background:C.goldFaint,border:`1px solid ${C.borderAccent}`,borderRadius:4,flexShrink:0}}>
                                      Standalone
                                    </span>
                                  )}
                                </div>
                                <div style={{fontFamily:F.body,fontSize:12,color:C.textSecondary,marginBottom:5,display:"flex",alignItems:"center",gap:4,flexWrap:"wrap"}}>
                                  <span>{reservation.email||"-"}</span>
                                  {reservation.phone&&<><span style={{color:C.textTertiary}}>·</span><span>{reservation.phone}</span></>}
                                </div>
                                <div style={{display:"flex",alignItems:"center",gap:6,flexWrap:"wrap"}}>
                                  {reservation.room&&(
                                    <span style={{fontFamily:F.body,fontSize:11,color:C.textTertiary}}>{reservation.room}</span>
                                  )}
                                  {(() => {
                                    const cardParentVenue = venueRows?.find(v => v.name === reservation.room || v.display_name === reservation.room);
                                    const cardHasChildren = cardParentVenue && (cardParentVenue.children?.length > 0 || venueRows?.some(v => v.parent_id === cardParentVenue.id));
                                    if (cardHasChildren) {
                                      return (
                                        <>
                                          <span style={{color: C.textTertiary, fontSize: 11}}>·</span>
                                          {reservation.assigned_room_id || reservation.internal_room_name === "Whole Venue" ? (
                                            <span style={{
                                              fontFamily: F.body,
                                              fontSize: 11,
                                              color: C.green,
                                              fontWeight: 600,
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: 4
                                            }}>
                                              <span style={{width: 5, height: 5, borderRadius: "50%", background: C.green}} />
                                              Assigned: {reservation.internal_room_name}
                                            </span>
                                          ) : (
                                            <span style={{
                                              fontFamily: F.body,
                                              fontSize: 11,
                                              color: C.red,
                                              fontWeight: 700,
                                              background: C.redFaint,
                                              border: `1px solid ${C.redBorder}`,
                                              padding: "1px 6px",
                                              borderRadius: 4,
                                              display: "inline-flex",
                                              alignItems: "center",
                                              gap: 4
                                            }}>
                                              <span style={{width: 5, height: 5, borderRadius: "50%", background: C.red}} />
                                              Needs room assignment
                                            </span>
                                          )}
                                        </>
                                      );
                                    }
                                    return null;
                                  })()}
                                  {reservation.table_number&&(
                                    <>
                                      <span style={{color:C.textTertiary,fontSize:11}}>·</span>
                                      <span style={{fontFamily:F.body,fontSize:11,color:isStandaloneCard?C.gold:seatTextColor,fontWeight:isStandaloneCard?600:seatTextWeight}}>
                                        {formatTableNumber(reservation.table_number)}
                                      </span>
                                    </>
                                  )}
                                  {(reservation.seat||reservation.seat_number)&&(
                                    <>
                                      <span style={{color:C.textTertiary,fontSize:11}}>·</span>
                                      <span style={{fontFamily:F.body,fontSize:11,color:seatTextColor,fontWeight:seatTextWeight}}>
                                        Seat {reservation.seat||reservation.seat_number}
                                      </span>
                                    </>
                                  )}
                                </div>
                                <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr 1fr":"repeat(6,minmax(90px,1fr))",gap:8,marginTop:10,paddingTop:10,borderTop:`1px solid ${C.divider}`}}>
                                  {[
                                    ["Time Until", reservation._timeUntil],
                                    ["Request Age", reservation._requestAge],
                                    ["Guests", `${reservation.guests_count || reservation.guests || 0} pax`],
                                    ["Type", String(reservation.type || "whole").replace(/_/g," ")],
                                    ["Last Action", lastActionSummary(reservation)],
                                    ["Notify", reservation._notificationStatus],
                                  ].map(([label,value])=>(
                                    <div key={label} style={{minWidth:0}}>
                                      <div style={{fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.13em",textTransform:"uppercase",color:C.textTertiary,marginBottom:3}}>{label}</div>
                                      <div style={{fontSize:11.5,color:C.textSecondary,fontWeight:label==="Time Until"&&reservation._priority?.key==="urgent"?700:520,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",textTransform:label==="Type"?"capitalize":"none"}}>{value}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:7,flexShrink:0}}>
                                <PriorityBadge priority={reservation._priority}/>
                                <StatusBadge status={reservation.status}/>
                                <StateBadge state={getReservationState(reservation)}/>
                                <span style={{fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",color:C.textTertiary}}>
                                  {reservation._historyCount} history
                                </span>
                                <div style={{display:"flex",alignItems:"center",gap:3,fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",color:C.textTertiary}}>
                                  View
                                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {!loading && filteredReservations.length > 0 && (
                  <PaginationControls
                    pagination={pagination}
                    onPageChange={handlePageChange}
                    onRowsChange={handleRowsChange}
                    filteredCount={filteredReservations.length}
                    isMobile={isMobile}
                  />
                )}
              </div>
            </div>
          </div>
        </div>

        {toast&&<Toast message={toast.message} type={toast.type} onClose={()=>setToast(null)}/>}

        {showModal&&selectedReservation&&(
          <DetailModal
            reservation={selectedReservation}
            onClose={()=>{setShowModal(false);setSelectedReservation(null);}}
            onApprove={handleApprove}
            onReject={handleReject}
            onRevert={handleRevert}
            onCancel={handleCancel}
            onUpdate={handleUpdateDetails}
            canManage={canManageReservations}
            canAdjust={canAdjustReservations}
            venueRows={venueRows}
          />
        )}
      </div>
    </>
  );
}
