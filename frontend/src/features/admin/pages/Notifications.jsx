// src/features/admin/pages/Notifications.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Bell, BellDot, Clock, X, CalendarDays,
  MapPin, Users, Phone, Mail, FileText, Hash, CheckCircle,
  Wifi, WifiOff, ThumbsUp, ChevronLeft, ChevronRight,
  XCircle, Search, Inbox, Eye, EyeOff, Check, AlertCircle, ArrowUpDown, ChevronDown, Check as CheckIcon
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import Sidebar from "../../../components/layout/Sidebar";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
import { reservationAPI } from "../../../services/reservationAPI";
import { authAPI } from "../../../services/authAPI";
import { ADMIN_OUTLET_GROUPS, ADMIN_OUTLET_ROOMS, canonicalOutletName, getScopedOutletRooms, canAccessOutlet } from "../../../constants/outletCatalog";

import { useAdminTheme, C, F } from "../../../context/AdminThemeContext";

function getTokens() {
  return C;
}

const POLL_INTERVAL_MS = 1000;
const RECONNECT_WINDOW_MS = 60000;
const MAX_RECONNECTS_IN_WINDOW = 5;
const WS_RECOVERY_RETRY_MS = 45000;
const ACK_STORAGE_KEY = "notification_acknowledgments";

// ─── Shared optimisticSeatUpdate (mirrors ReservationDashboard) ───────────────
// When approving from NotificationDashboard, this updates localStorage so the
// client seatmap page turns the seat red immediately (same as ReservationDashboard).
const DEFAULT_WING = "Main Wing";

function layoutKey(wing, room) { return `seatmap_layout:${wing}:${room}`; }

function optimisticSeatUpdate(reservation, newSeatStatus) {
  try {
    const wing = String(reservation.wing ?? DEFAULT_WING).trim();
    const room = String(reservation.room ?? reservation.venue?.name ?? reservation.venue ?? "").trim();
    if (!room) return;

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

    const rawSeatField = String(
      reservation.seat ?? reservation.seat_number ?? ""
    ).trim();
    const seatNums = new Set(
      rawSeatField.split(",").map(s => s.trim()).filter(Boolean)
    );
    const guestsCount = parseInt(reservation.guests_count ?? reservation.guests ?? 0, 10);
    const reservationType = String(reservation.type ?? "").toLowerCase();

    const persist = (updated) => {
      const payload = JSON.stringify(updated);
      localStorage.setItem(key, payload);
      // Broadcast to other tabs
      window.dispatchEvent(new StorageEvent("storage", {
        key, newValue: payload, storageArea: localStorage,
      }));
      // Same-tab update: client pages listen for this and call fetchAndMerge()
      window.dispatchEvent(new CustomEvent("seatmap:saved", {
        detail: { wing, room, payload },
      }));
    };

    if (isStandalone) {
      const updatedStandaloneSeats = (layout.standaloneSeats || []).map(s => {
        const num = String(s.num ?? s.label ?? s.id ?? "").trim();
        const sid = String(s.id ?? "").trim();
        return (seatNums.has(num) || seatNums.has(sid))
          ? { ...s, status: newSeatStatus }
          : s;
      });
      persist({ ...layout, standaloneSeats: updatedStandaloneSeats });
      return;
    }

    const tableId = String(reservation.table_number ?? "").trim();

    const updatedTables = (layout.tables || []).map(t => {
      const tId = String(t.id ?? "").trim();
      const tLabel = String(t.label ?? "").trim();
      const normTableId = tableId.replace(/^T/i, "");
      const normTId = tId.replace(/^T/i, "");
      const normTLabel = tLabel.replace(/^T/i, "");

      const tableMatches =
        tId === tableId || tLabel === tableId ||
        normTId === normTableId || normTLabel === normTableId;

      if (!tableMatches) return t;

      const isWholeTable = reservationType === "whole" || seatNums.size > 1;

      if (isWholeTable) {
        if (seatNums.size > 0) {
          return {
            ...t,
            seats: (t.seats || []).map(s => {
              const num = String(s.num ?? s.label ?? s.id ?? "").trim();
              const sid = String(s.id ?? "").trim();
              return (seatNums.has(num) || seatNums.has(sid))
                ? { ...s, status: newSeatStatus } : s;
            }),
          };
        } else {
          let marked = 0;
          return {
            ...t,
            seats: (t.seats || []).map(s => {
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
        seats: (t.seats || []).map(s => {
          const num = String(s.num ?? s.label ?? s.id ?? "").trim();
          const sid = String(s.id ?? "").trim();
          return (seatNums.has(num) || seatNums.has(sid))
            ? { ...s, status: newSeatStatus } : s;
        }),
      };
    });

    persist({ ...layout, tables: updatedTables });
  } catch (err) {
    console.warn("[NotificationDashboard] optimisticSeatUpdate error:", err);
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────
function normaliseRow(r) {
  const isWS = !r.room && !r.eventDate && (r.event_date || r.eventDate);
  if (isWS) {
    return {
      ...r,
      db_id: Number(r.db_id ?? r.id),
      id: r.reference_code ?? String(r.id),
      room: r.room || r.venue?.name || r.venue || "Alabang Function Room",
      table: r.table_number || r.table,
      seat: r.seat_number || r.seat,
      guests: r.guests_count || r.guests || r.guests_number,
      eventDate: r.event_date || r.eventDate,
      eventTime: r.event_time || r.eventTime,
      specialRequests: r.special_requests || r.specialRequests || r.notes || r.remarks,
      submittedTimestamp: r.submitted_timestamp || r.submittedTimestamp,
      guest_name: r.name || r.guest_name,
      status: r.status || r.reservationStatus || r.reservation_status || 'pending'
    };
  }
  return {
    ...r,
    db_id: Number(r.db_id ?? r.id),
    id: r.reference_code ?? String(r.id),
    guests: r.guests_count || r.guests || r.guests_number || r.guests,
    specialRequests: r.special_requests || r.specialRequests || r.notes || r.remarks,
    guest_name: r.name || r.guest_name,
    status: r.status || r.reservationStatus || r.reservation_status || 'pending'
  };
}
function shouldTrack(r) {
  const s = (r.status || "").toLowerCase().trim();
  return s !== "cancelled" && s !== "canceled" && s !== "deleted" && s !== "archived";
}
function isApproved(r) {
  const s = (r.status || "").toLowerCase().trim();
  return ["reserved","approved","confirmed","done","completed","accepted"].includes(s);
}
function isDeclined(r) {
  const s = (r.status || "").toLowerCase().trim();
  return ["rejected","declined"].includes(s);
}
function isPending(r) {
  const s = (r.status || "").toLowerCase().trim();
  return s === "pending" || s === "awaiting" || s === "under review";
}
function getOutletName(res) {
  return canonicalOutletName(res.room || res.venue?.name || res.venue || "Unassigned Outlet");
}
function parseEventDate(d, t) {
  if (!d) return null;
  let b = new Date(d);
  if (isNaN(b)) {
    const cleanDate = String(d).trim().replace(/[^\d\-\/]/g, '');
    b = new Date(cleanDate);
    if (isNaN(b)) return null;
  }
  if (t) {
    const m = t.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (m) {
      let h = +m[1];
      if (m[3] && m[3].toUpperCase() === "PM" && h !== 12) h += 12;
      if (m[3] && m[3].toUpperCase() === "AM" && h === 12) h = 0;
      b.setHours(h, +m[2], 0, 0);
    }
  }
  return b;
}
function fmtTime(t) { if (!t) return "—"; const m = t.match(/^(\d{1,2}):(\d{2})$/); if (m) { const h = +m[1]; return `${((h+11)%12)+1}:${m[2]} ${h>=12?"PM":"AM"}`; } return t; }
function fmtDate(d) { if (!d) return "—"; const dt = new Date(d); return isNaN(dt) ? String(d) : dt.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" }); }
function relLabel(ms) { if (ms<=0) return "now"; const m=Math.round(ms/60000); if (m<60) return `${m} min`; const h=Math.floor(m/60),r=m%60; return r===0?`${h} hr`:`${h} hr ${r} min`; }
function clockStr() { return new Date().toLocaleTimeString("en-PH",{hour:"2-digit",minute:"2-digit",second:"2-digit"}); }
function dateStr()  { return new Date().toLocaleDateString("en-PH",{weekday:"long",month:"long",day:"numeric",year:"numeric"}); }
function notificationId(res) { return String(res?.id ?? res?.db_id ?? res?.reference_code ?? ""); }

function timeAgo(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.round(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function outletCountsFor(cards) {
  const counts = new Map();
  cards.forEach((res) => {
    const outlet = getOutletName(res);
    const current = counts.get(outlet) || {
      outlet,
      total: 0,
      pending: 0,
      upcoming: 0,
      accepted: 0,
      declined: 0,
    };
    current.total += 1;
    if (isPending(res)) current.pending += 1;
    if (isDeclined(res)) current.declined += 1;
    if (isApproved(res)) {
      current.accepted += 1;
      const dt = parseEventDate(res.event_date || res.eventDate || res.reservationDate, res.event_time || res.eventTime || res.reservationTime);
      if (!dt || dt.getTime() > Date.now()) current.upcoming += 1;
    }
    counts.set(outlet, current);
  });
  return Array.from(counts.values()).sort((a, b) => a.outlet.localeCompare(b.outlet));
}

function loadAcknowledgments() {
  try {
    return JSON.parse(localStorage.getItem(ACK_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function normalizeAcknowledgments(items) {
  if (!Array.isArray(items)) return {};
  return items.reduce((acc, item) => {
    const id = String(item.id || item.notification_key || item.reservation_id || "");
    if (!id) return acc;
    acc[id] = {
      id,
      reservation_id: item.reservation_id,
      name: item.name || "Reservation",
      room: item.room || item.outlet || "",
      eventDate: item.eventDate || item.event_date,
      eventTime: item.eventTime || item.event_time,
      acknowledgedAt: item.acknowledgedAt || item.acknowledged_at,
      acknowledgedBy: item.acknowledgedBy || item.acknowledged_by_name,
      acknowledgedByRole: item.acknowledgedByRole || item.acknowledged_by_role,
    };
    return acc;
  }, {});
}

// ─── Audio ────────────────────────────────────────────────────────────────────
let _alertId = null;
function stopAlert() { if (_alertId) { clearInterval(_alertId); _alertId = null; } }
function _beep(notes, onDone) {
  try {
    const ctx = new (window.AudioContext||window.webkitAudioContext)();
    const end = notes.reduce((t,{f,d,w="sine"}) => { const o=ctx.createOscillator(),g=ctx.createGain(); o.connect(g);g.connect(ctx.destination);o.type=w;o.frequency.setValueAtTime(f,t);g.gain.setValueAtTime(0.18,t);g.gain.exponentialRampToValueAtTime(0.001,t+d);o.start(t);o.stop(t+d);return t+d+0.05; }, ctx.currentTime+0.05);
    if (onDone) setTimeout(onDone, (end-ctx.currentTime)*1000+400);
  } catch { if (onDone) onDone(); }
}
function playAlertThenSpeak(text) { stopAlert(); _beep([{f:880,d:.12,w:"square"},{f:880,d:.12,w:"square"},{f:1100,d:.24,w:"square"}],()=>speakText(text)); _alertId=setInterval(()=>_beep([{f:880,d:.12,w:"square"},{f:880,d:.12,w:"square"},{f:1100,d:.24,w:"square"}]),4000); }
function playPendingChime() { _beep([{f:1046,d:.13},{f:784,d:.13},{f:523,d:.22}]); }
function playApproveSound() { _beep([{f:523,d:.08},{f:659,d:.08},{f:784,d:.08},{f:1047,d:.20}]); }
function speakText(text) { if (!window.speechSynthesis) return; window.speechSynthesis.cancel(); const u=new SpeechSynthesisUtterance(text); u.rate=0.95;u.pitch=1.05;u.volume=1; const v=window.speechSynthesis.getVoices(); const eng=v.find(x=>x.lang.startsWith("en")&&/female|zira|samantha/i.test(x.name))||v.find(x=>x.lang.startsWith("en")); if(eng)u.voice=eng; window.speechSynthesis.speak(u); }

// ─── Primitives ───────────────────────────────────────────────────────────────
function Spinner({ size=13, C }) {
  return <span style={{ display:"inline-block",width:size,height:size,border:`1.5px solid ${C.spinnerBorder}`,borderTopColor:C.spinnerTop,borderRadius:"50%",animation:"spin 0.65s linear infinite",flexShrink:0 }} />;
}

function StatusBadge({ status, C }) {
  const s = (status||"").toLowerCase().trim();
  if (s==="rejected"||s==="declined") {
    return (
      <span style={{ display:"inline-flex",alignItems:"center",gap:5,background:C.badgeRejected.bg,color:C.badgeRejected.color,padding:"4px 10px 4px 8px",borderRadius:4,fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:F.label,border:`1px solid ${C.badgeRejected.color}30` }}>
        <span style={{ width:4,height:4,borderRadius:"50%",background:C.badgeRejected.dot }} />Declined
      </span>
    );
  }
  const cfg = s==="reserved"||s==="approved"||s==="confirmed" ? {...C.badgeApproved,label:"Reserved"} : s==="done" ? {bg:C.blueFaint,color:C.blue,dot:C.blue,label:"Done"} : s==="pending" ? {...C.badgePending,label:"Pending"} : {bg:C.borderDefault,color:C.textSecondary,dot:C.textSecondary,label:s||"—"};
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:5,background:cfg.bg,color:cfg.color,padding:"4px 10px 4px 8px",borderRadius:4,fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",fontFamily:F.label,border:`1px solid ${cfg.color}30` }}>
      <span style={{ width:4,height:4,borderRadius:"50%",background:cfg.dot }} />{cfg.label}
    </span>
  );
}

function SectionLabel({ children, C, style={} }) {
  return <div style={{ fontFamily:F.label,fontSize:9,letterSpacing:"0.20em",color:C.gold,fontWeight:700,textTransform:"uppercase",marginBottom:14,paddingBottom:8,borderBottom:`1px solid ${C.divider}`,...style }}>{children}</div>;
}

// ─── Modal Shell + Header ─────────────────────────────────────────────────────
function ModalShell({ children, onClose, disabled, C, maxWidth=520, zIndex=4000 }) {
  return (
    <div style={{ position:"fixed",inset:0,background:C.modalOverlay,zIndex,display:"flex",alignItems:"center",justifyContent:"center",padding:20,backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)" }} onClick={e=>{ if(e.target===e.currentTarget&&!disabled)onClose(); }}>
      <div style={{ background:C.surfaceBase,borderRadius:14,width:"100%",maxWidth,maxHeight:"92vh",boxShadow:"0 20px 60px rgba(0,0,0,0.20)",border:`1px solid ${C.borderDefault}`,fontFamily:F.body,animation:"modalIn 0.20s cubic-bezier(0.16,1,0.3,1)",overflow:"hidden" }}>
        <div style={{ height:"2px",background:`linear-gradient(90deg,transparent,${C.gold}80 30%,${C.gold}80 70%,transparent)` }} />
        {children}
      </div>
    </div>
  );
}

// FIX: ModalHeader now renders title in dark text (C.textPrimary) since the
// headerGradient is light (#FAF8F4 → #F2EFE8). Previously the title was
// inheriting "#EDE8DF" (near-white) which was invisible on the light background.
function ModalHeader({ eyebrow, title, onClose, disabled, C, right, hideClose=false }) {
  return (
    <div style={{ background:C.headerGradient,padding:"20px 22px 18px",position:"sticky",top:0,zIndex:2,borderBottom:`1px solid ${C.divider}` }}>
      <div style={{ position:"absolute",top:14,right:16,zIndex:20,display:"flex",alignItems:"center",gap:10 }}>
        {right}
        {!hideClose&&<button
          onClick={onClose}
          disabled={disabled}
          style={{ width:32,height:32,borderRadius:"50%",background:"transparent",border:`1px solid ${C.borderDefault}`,cursor:disabled?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,transition:"all 0.18s" }}
          onMouseEnter={e=>{ if(!disabled){e.currentTarget.style.borderColor=C.gold;e.currentTarget.style.background=C.goldFaint;} }}
          onMouseLeave={e=>{ if(!disabled){e.currentTarget.style.borderColor=C.borderDefault;e.currentTarget.style.background="transparent";} }}
        >
          <X size={12} color={C.textSecondary} strokeWidth={2.5} />
        </button>}
      </div>
      <div style={{ paddingRight:80 }}>
        {eyebrow && (
          <div style={{ fontFamily:F.label,fontSize:9,letterSpacing:"0.22em",color:C.gold,fontWeight:700,textTransform:"uppercase",marginBottom:6,opacity:0.90 }}>
            {eyebrow}
          </div>
        )}
        {/* FIX: Use C.textPrimary (dark) — headerGradient is LIGHT, not dark */}
        <div style={{ fontFamily:F.display,fontSize:20,fontWeight:700,color:C.textPrimary,letterSpacing:"0.01em",lineHeight:1.2 }}>
          {title}
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, value, icon, C, accent }) {
  return (
    <div style={{ display:"flex",alignItems:"flex-start",gap:12,marginBottom:10 }}>
      <div style={{ width:30,height:30,borderRadius:8,flexShrink:0,background:C.goldFaintest,border:`1px solid ${C.borderAccent}`,display:"flex",alignItems:"center",justifyContent:"center",marginTop:1 }}>
        {React.cloneElement(icon,{size:13,color:C.gold})}
      </div>
      <div style={{ flex:1 }}>
        <div style={{ fontFamily:F.label,fontSize:9,letterSpacing:"0.18em",color:C.textTertiary,fontWeight:700,textTransform:"uppercase",marginBottom:3 }}>{label}</div>
        <div style={{ fontFamily:F.body,fontSize:13,fontWeight:500,color:accent?C.gold:C.textPrimary,lineHeight:1.45 }}>{value||"—"}</div>
      </div>
    </div>
  );
}

// ─── Approve Confirm Modal ────────────────────────────────────────────────────
function ApproveConfirmModal({ res, onConfirm, onCancel, isApproving, C }) {
  if (!res) return null;
  return (
    <ModalShell onClose={onCancel} disabled={isApproving} C={C} maxWidth={400} zIndex={5000}>
      <ModalHeader eyebrow="Confirm Approval" title={res.guest_name||res.name||"Reservation"} onClose={onCancel} disabled={isApproving} C={C} hideClose />
      <div style={{ padding:"20px 24px 26px" }}>
        <div style={{ display:"none",padding:"14px 16px",borderRadius:10,marginBottom:18,background:C.goldFaintest,border:`1px solid ${C.borderAccent}` }}>
          <div style={{ fontFamily:F.body,fontSize:14,fontWeight:600,color:C.textPrimary,marginBottom:4 }}>{res.guest_name||res.name||"Unknown Guest"}</div>
          <div style={{ fontFamily:F.body,fontSize:12,color:C.textSecondary,lineHeight:1.6 }}>
            {res.room||res.venue?.name||res.venue||"—"} · {fmtDate(res.event_date||res.eventDate)} · {fmtTime(res.event_time||res.eventTime)}
          </div>
          <div style={{ fontFamily:F.mono,fontSize:11,color:C.textTertiary,marginTop:4 }}>
            Ref: {res.reference_code||res.id||"—"}
          </div>
        </div>
        <div style={{ padding:"10px 14px",borderRadius:8,marginBottom:20,background:C.greenFaint,border:`1px solid ${C.greenBorder}`,fontFamily:F.body,fontSize:12.5,color:C.textSecondary,lineHeight:1.65 }}>
          This will approve the reservation, reserve the selected seat/table, and send a confirmation email to the guest. This cannot be undone from this action.
        </div>
        <div style={{ display:"grid",gap:8,marginBottom:16 }}>
          {[["Current Status","Pending"],["New Status","Reserved"],["Reference",res.reference_code||res.id||"-"]].map(([label,value])=>(
            <div key={label} style={{display:"flex",justifyContent:"space-between",gap:12,padding:"8px 0",borderBottom:`1px solid ${C.divider}`}}>
              <span style={{fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary}}>{label}</span>
              <span style={{fontFamily:F.body,fontSize:12.5,fontWeight:600,color:C.textPrimary,textAlign:"right"}}>{value}</span>
            </div>
          ))}
        </div>
        <div style={{ display:"flex",gap:8 }}>
          <button
            onClick={onCancel}
            disabled={isApproving}
            style={{ flex:1,padding:"12px",background:"transparent",border:`1px solid ${C.borderDefault}`,borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:C.textSecondary,cursor:isApproving?"not-allowed":"pointer",transition:"all 0.18s" }}
            onMouseEnter={e=>{ if(!isApproving){e.currentTarget.style.borderColor=C.borderAccent;e.currentTarget.style.color=C.gold;} }}
            onMouseLeave={e=>{ if(!isApproving){e.currentTarget.style.borderColor=C.borderDefault;e.currentTarget.style.color=C.textSecondary;} }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            disabled={isApproving}
            style={{ flex:2,padding:"12px",border:"none",borderRadius:8,background:isApproving?C.green+"80":C.green,color:"#fff",fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",cursor:isApproving?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all 0.18s" }}
          >
            {isApproving?<><Spinner C={C} size={12}/>Approving…</>:<><ThumbsUp size={12}/>Approve</>}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DeclineConfirmModal({ res, onConfirm, onCancel, isDeclining, C }) {
  const [reason,setReason]=useState("");
  const [showConfirmation,setShowConfirmation]=useState(false);
  const trimmed=reason.trim();
  const canSubmit=trimmed.length>=5&&!isDeclining;
  if (!res) return null;
  if (showConfirmation) {
    return (
      <ModalShell onClose={()=>setShowConfirmation(false)} disabled={isDeclining} C={C} maxWidth={440} zIndex={5100}>
        <ModalHeader eyebrow="Confirm Rejection" title={res.guest_name||res.name||"Reservation"} onClose={()=>setShowConfirmation(false)} disabled={isDeclining} C={C} />
        <div style={{ padding:"20px 22px 24px" }}>
          <div style={{ padding:"10px 14px",borderRadius:8,marginBottom:14,background:C.redFaint,border:`1px solid ${C.redBorder}`,fontFamily:F.body,fontSize:12,color:C.textSecondary,lineHeight:1.65 }}>
            This will mark the reservation as rejected, move it to inactive, release the selected seat/table, and send the rejection reason to the guest.
          </div>
          <div style={{ fontFamily:F.label,fontSize:9,letterSpacing:"0.18em",color:C.textSecondary,fontWeight:700,textTransform:"uppercase",marginBottom:7 }}>Reason to Send</div>
          <div style={{ padding:"11px 13px",border:`1px solid ${C.borderDefault}`,borderRadius:8,background:"rgba(0,0,0,0.02)",fontFamily:F.body,fontSize:12,color:C.textPrimary,lineHeight:1.6,whiteSpace:"pre-wrap",maxHeight:120,overflowY:"auto" }}>{trimmed}</div>
          <div style={{ display:"flex",gap:8,marginTop:16 }}>
            <button onClick={()=>setShowConfirmation(false)} disabled={isDeclining} style={{ flex:1,padding:"11px",background:"transparent",border:`1px solid ${C.borderDefault}`,borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textSecondary,cursor:isDeclining?"not-allowed":"pointer" }}>Back</button>
            <button onClick={()=>onConfirm(trimmed)} disabled={isDeclining} style={{ flex:2,padding:"11px",background:isDeclining?"rgba(160,56,56,0.35)":C.red,border:"none",borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:"#fff",cursor:isDeclining?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7 }}>{isDeclining?<><Spinner C={C} size={12}/>Rejecting...</>:"Confirm Reject"}</button>
          </div>
        </div>
      </ModalShell>
    );
  }
  return (
    <ModalShell onClose={onCancel} disabled={isDeclining} C={C} maxWidth={420} zIndex={5000}>
      <ModalHeader eyebrow="Reject Reservation" title={res.guest_name||res.name||"Reservation"} onClose={onCancel} disabled={isDeclining} C={C} />
      <div style={{ padding:"20px 24px 26px" }}>
        <div style={{ padding:"10px 14px",borderRadius:8,marginBottom:18,background:C.redFaint,border:`1px solid ${C.redBorder}`,fontFamily:F.body,fontSize:12,color:C.textSecondary,lineHeight:1.65 }}>
          A rejection email will be sent to <strong style={{ color:C.textPrimary }}>{res.email||res.guest_email||"the guest"}</strong> after you review and confirm the rejection.
        </div>
        <div style={{ fontFamily:F.label,fontSize:9,letterSpacing:"0.18em",color:C.textSecondary,fontWeight:700,textTransform:"uppercase",marginBottom:7 }}>Reason for Rejection <span style={{ color:C.red }}>*</span></div>
        <textarea value={reason} onChange={e=>setReason(e.target.value)} placeholder="e.g. Venue fully booked for the requested date, capacity exceeded..." disabled={isDeclining} rows={4} style={{ width:"100%",resize:"vertical",minHeight:92,padding:"11px 12px",border:`1px solid ${C.borderDefault}`,borderRadius:8,outline:"none",fontFamily:F.body,fontSize:13,color:C.textPrimary,background:C.surfaceBase,marginBottom:8 }} />
        <div style={{ fontFamily:F.body,fontSize:11,color:canSubmit?C.textSecondary:C.red,marginBottom:16 }}>Enter at least 5 characters before confirming.</div>
        <div style={{ display:"flex",gap:8 }}>
          <button onClick={onCancel} disabled={isDeclining} style={{ flex:1,padding:"12px",background:"transparent",border:`1px solid ${C.borderDefault}`,borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:C.textSecondary,cursor:isDeclining?"not-allowed":"pointer" }}>Cancel</button>
          <button onClick={()=>canSubmit&&setShowConfirmation(true)} disabled={!canSubmit} style={{ flex:2,padding:"12px",border:"none",borderRadius:8,background:canSubmit?C.red:"rgba(160,56,56,0.35)",color:"#fff",fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",cursor:canSubmit?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>Review Rejection</button>
        </div>
      </div>
    </ModalShell>
  );
}

function reservationStateForStatus(status) {
  const s = (status || "").toLowerCase();
  return s === "rejected" || s === "cancelled" || s === "declined" ? "inactive" : "active";
}

function getReservationState(reservation) {
  return (reservation?.reservation_state || reservationStateForStatus(reservation?.status)).toLowerCase();
}

function StateBadge({ state, C }) {
  const s = (state || "active").toLowerCase();
  const active = s === "active";
  const color = active ? C.green : C.textSecondary;
  const bg = active ? C.greenFaint : "rgba(0,0,0,0.05)";
  const border = active ? C.greenBorder : C.borderDefault;
  return (
    <span style={{ display:"inline-flex",alignItems:"center",gap:5,padding:"4px 10px 4px 8px",background:bg,border:`1px solid ${border}`,borderRadius:4,fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color,flexShrink:0 }}>
      <span style={{ width:4,height:4,borderRadius:"50%",background:color,flexShrink:0 }}/>
      {active ? "Active" : "Inactive"}
    </span>
  );
}

function DetailModal({ res, onClose, onApprove, onDecline, approvingIds, decliningIds, canManage, C }) {
  if (!res) return null;
  const rawStatus = (res.status||"").toLowerCase();
  const resIsPending = rawStatus === "pending";
  const reservationState = getReservationState(res);
  const resId = res.id ?? res.db_id;
  const isApprovingThis = approvingIds?.has(resId);
  const isDecliningThis = decliningIds?.has(resId);
  const fmtDateTime=(value)=>{if(!value)return"-";try{return new Date(value).toLocaleString("en-US",{year:"numeric",month:"short",day:"numeric",hour:"numeric",minute:"2-digit"});}catch{return value;}};
  const reservationRows=[
    ["Reference", res.reference_code||res.id||"-"],
    ["Room", getOutletName(res)],
    ["Type", res.type==="whole"?"Whole Table":res.type==="standalone"?"Standalone Seat":res.type==="individual"?"Individual Seat":res.type||"-"],
    ["Table", res.table_number??res.table?`Table ${res.table_number||res.table}`:"-"],
    ["Seat", res.seat_number??res.seat ? (String(res.seat_number??res.seat).trim().toLowerCase().startsWith("seat") ? String(res.seat_number??res.seat).trim() : `Seat ${String(res.seat_number??res.seat).trim()}`) : "-"],
    ["Guests", (res.guests_count||res.guests||1)>0?`${res.guests_count||res.guests||1} guest${(res.guests_count||res.guests||1)!==1?"s":""}`:"-"],
    ["Event Date", fmtDate(res.event_date||res.eventDate||res.reservationDate)],
    ["Event Time", fmtTime(res.event_time||res.eventTime||res.reservationTime)],
    ...((res.event_area || res.eventArea) ? [["Event Area", res.event_area || res.eventArea]] : []),
    ...((res.setup_tables ?? res.setupTables) ? [["Tables Needed", res.setup_tables ?? res.setupTables]] : []),
    ...((res.setup_chairs ?? res.setupChairs) ? [["Chairs Needed", res.setup_chairs ?? res.setupChairs]] : []),
    ...((res.setup_requirements || res.setupRequirements) ? [["Setup Requirements", res.setup_requirements || res.setupRequirements]] : []),
  ];
  const guestRows=[
    ["Full Name", res.guest_name||res.name||"-"],
    ["Email", res.email||res.guest_email||"-"],
    ["Phone", res.phone||res.contact||res.guest_phone||"-"],
    ["Special Requests", res.special_requests||res.specialRequests||res.notes||"None"],
  ];
  const trackingRows=[
    ["Previous Status", res.previous_status||"-"],
    ["Last Status Change", fmtDateTime(res.status_last_changed_at||res.updated_at)],
    ["Rejected At", fmtDateTime(res.rejected_at)],
    ["Reverted At", fmtDateTime(res.reverted_at)],
  ];
  const historyItems = Array.isArray(res.transaction_history) ? res.transaction_history.slice(0, 6) : [];
  const formatHistoryAction = (action) => String(action || "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Transaction";
  const renderRows=(rows)=>rows.map(([label,value],i,arr)=>(
    <div key={label} style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"8px 0",borderBottom:i<arr.length-1?`1px solid ${C.divider}`:"none"}}>
      <span style={{fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary,minWidth:120,flexShrink:0}}>{label}</span>
      <span style={{fontFamily:F.body,fontSize:12.5,color:label==="Reference"?C.gold:C.textPrimary,fontWeight:label==="Reference"?700:500,textAlign:"right",maxWidth:280,lineHeight:1.5}}>{value}</span>
    </div>
  ));
  return (
    <ModalShell onClose={onClose} C={C} maxWidth={520}>
      <ModalHeader eyebrow="Reservation Detail" title={res.guest_name||res.name||"Guest"} onClose={onClose} C={C} right={<><StatusBadge status={rawStatus} C={C}/><StateBadge state={reservationState} C={C}/></>} />
      <div style={{ padding:"18px 22px 24px",maxHeight:"66vh",overflowY:"auto" }}>
        <SectionLabel C={C} style={{ marginTop:18 }}>Reservation Details</SectionLabel>
        {renderRows(reservationRows)}
        <SectionLabel C={C} style={{ marginTop:18 }}>Guest Information</SectionLabel>
        {renderRows(guestRows)}
        <SectionLabel C={C} style={{ marginTop:18 }}>Status Tracking</SectionLabel>
        {renderRows(trackingRows)}
        <SectionLabel C={C} style={{ marginTop:18 }}>Reservation History</SectionLabel>
        {historyItems.length ? historyItems.map((item,i)=>(
          <div key={item.id || `${item.action}-${i}`} style={{padding:"9px 0",borderBottom:i<historyItems.length-1?`1px solid ${C.divider}`:"none"}}>
            <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
              <span style={{fontFamily:F.body,fontSize:12.5,fontWeight:700,color:C.textPrimary,lineHeight:1.4}}>{formatHistoryAction(item.action)}</span>
              <span style={{fontFamily:F.body,fontSize:11,color:C.textSecondary,textAlign:"right",whiteSpace:"nowrap"}}>{fmtDateTime(item.created_at)}</span>
            </div>
            <div style={{fontFamily:F.body,fontSize:11.5,color:C.textSecondary,lineHeight:1.5,marginTop:3}}>
              {(item.from_status || item.to_status) && <span style={{textTransform:"capitalize"}}>{item.from_status || "-"} {"->"} {item.to_status || "-"}</span>}
              {item.notes ? <span>{item.from_status || item.to_status ? " - " : ""}{item.notes}</span> : null}
            </div>
          </div>
        )) : (
          <div style={{fontFamily:F.body,fontSize:12,color:C.textSecondary,lineHeight:1.5}}>No transaction history recorded yet.</div>
        )}
      </div>
      {resIsPending&&onApprove&&canManage&&(
      <div style={{ padding:"14px 22px",borderTop:`1px solid ${C.divider}`,display:"flex",gap:8 }}>
          <>
          <button onClick={()=>onDecline(res)} disabled={isApprovingThis||isDecliningThis} style={{ flex:1,padding:"12px",background:"transparent",border:`1px solid ${C.redBorder}`,borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:C.red,cursor:isApprovingThis||isDecliningThis?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8 }}>
            {isDecliningThis?<><Spinner C={C} size={12}/>Declining...</>:<><XCircle size={12}/>Decline</>}
          </button>
          <button
            onClick={()=>onApprove(res)}
            disabled={isApprovingThis}
            style={{ flex:2,padding:"12px",border:"none",borderRadius:8,background:isApprovingThis?C.green+"80":C.green,color:"#fff",fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",cursor:isApprovingThis?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all 0.18s" }}
          >
            {isApprovingThis?<><Spinner C={C} size={12}/>Approving…</>:<><ThumbsUp size={12}/>Approve</>}
          </button>
          </>
      </div>
      )}
    </ModalShell>
  );
}

// ─── Event Picker Modal ───────────────────────────────────────────────────────
function EventPickerModal({ items, allCards, onSelect, onClose, C }) {
  const [nowMs,setNowMs]=useState(Date.now());
  useEffect(()=>{ const t=setInterval(()=>setNowMs(Date.now()),30000); return()=>clearInterval(t); },[]);
  return (
    <ModalShell onClose={onClose} C={C} maxWidth={460} zIndex={4500}>
      <ModalHeader eyebrow="Upcoming Events" title={`${items.length} Events`} onClose={onClose} C={C}/>
      <div style={{ padding:"16px 22px 22px",maxHeight:"60vh",overflowY:"auto" }}>
        <p style={{ fontFamily:F.body,fontSize:12.5,color:C.textSecondary,marginBottom:16,lineHeight:1.6 }}>Select which event to inspect:</p>
        {items.map((item,idx)=>{
          const dt=parseEventDate(item.eventDate,item.eventTime),diff=dt?dt.getTime()-nowMs:null;
          const rel=diff!==null&&diff>0?relLabel(diff)+" to event":diff!==null?"Event started":null,urgent=diff!==null&&diff<=30*60000;
          const fullRes=allCards.find(r=>(r.id??r.db_id)===item.id);
          return (
            <button key={idx} onClick={()=>fullRes&&onSelect(fullRes)} disabled={!fullRes}
              style={{ display:"flex",width:"100%",textAlign:"left",background:C.surfaceRaised,border:`1.5px solid ${urgent?C.redBorder:C.borderDefault}`,borderRadius:10,padding:"14px 16px",marginBottom:8,cursor:fullRes?"pointer":"not-allowed",transition:"all 0.18s",gap:12,alignItems:"center",opacity:fullRes?1:0.55 }}
              onMouseEnter={e=>{ if(fullRes){e.currentTarget.style.borderColor=C.borderAccent;e.currentTarget.style.background=C.goldFaintest;} }}
              onMouseLeave={e=>{ if(fullRes){e.currentTarget.style.borderColor=urgent?C.redBorder:C.borderDefault;e.currentTarget.style.background=C.surfaceRaised;} }}
            >
              <div style={{ width:28,height:28,borderRadius:"50%",background:C.goldFaint,border:`1px solid ${C.borderAccent}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0 }}>
                <span style={{ fontFamily:F.label,fontSize:10,fontWeight:700,color:C.gold }}>{idx+1}</span>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontFamily:F.body,fontSize:13,fontWeight:600,color:C.textPrimary,marginBottom:4 }}>{item.name}</div>
                <div style={{ fontFamily:F.body,fontSize:11,color:C.textSecondary }}>{fmtDate(item.eventDate)} · {fmtTime(item.eventTime)}{item.room?` · ${item.room}`:""}</div>
              </div>
              {rel&&<span style={{ background:urgent?C.redFaint:C.goldFaint,border:`1px solid ${urgent?C.redBorder:C.borderAccent}`,borderRadius:4,padding:"3px 8px",fontSize:9,fontWeight:700,fontFamily:F.label,letterSpacing:"0.10em",textTransform:"uppercase",color:urgent?C.red:C.gold,whiteSpace:"nowrap" }}>{rel}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ padding:"14px 22px",borderTop:`1px solid ${C.divider}` }}>
        <button onClick={onClose} style={{ width:"100%",padding:"12px",background:"transparent",border:`1px solid ${C.borderDefault}`,borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:C.textSecondary,cursor:"pointer",transition:"all 0.18s" }} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.borderAccent;e.currentTarget.style.color=C.gold;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.borderDefault;e.currentTarget.style.color=C.textSecondary;}}>Dismiss</button>
      </div>
    </ModalShell>
  );
}

// ─── Reminder Popup ───────────────────────────────────────────────────────────
function ReminderPopup({ popup, onView, onClose, onAcknowledge, canAcknowledge, queueCount, C }) {
  const [nowMs,setNowMs]=useState(Date.now());
  useEffect(()=>{ const t=setInterval(()=>setNowMs(Date.now()),30000); return()=>clearInterval(t); },[]);
  const items=popup.items||[];
  return (
    <div style={{ position:"fixed",top:80,right:20,zIndex:9999,width:320,fontFamily:F.body,animation:"modalIn 0.30s cubic-bezier(0.16,1,0.3,1)" }}>
      <div style={{ background:C.surfaceBase,borderRadius:14,border:`1px solid ${C.borderAccent}`,boxShadow:"0 24px 80px rgba(0,0,0,0.28)",overflow:"hidden" }}>
        <div style={{ height:"2px",background:`linear-gradient(90deg,transparent,${C.gold}80 30%,${C.gold}80 70%,transparent)` }}/>
        <div style={{ padding:"16px 18px 14px" }}>
          <div style={{ display:"flex",alignItems:"flex-start",gap:12,marginBottom:14 }}>
            <div style={{ width:36,height:36,borderRadius:10,flexShrink:0,background:C.goldFaint,border:`1px solid ${C.borderAccent}`,display:"flex",alignItems:"center",justifyContent:"center",animation:"bellRing 0.6s ease 0.1s 4" }}>
              <BellDot size={16} color={C.gold}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:F.label,fontSize:9,letterSpacing:"0.22em",color:C.gold,fontWeight:700,textTransform:"uppercase",marginBottom:4 }}>Event Reminder</div>
              <div style={{ fontFamily:F.display,fontSize:16,fontWeight:700,color:C.textPrimary,lineHeight:1.2 }}>{items.length>1?`${items.length} Upcoming Events`:"Upcoming Event"}</div>
            </div>
            <button onClick={onClose} style={{ width:28,height:28,borderRadius:"50%",background:"transparent",border:`1px solid ${C.borderDefault}`,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",padding:0,transition:"all 0.18s",flexShrink:0 }} onMouseEnter={e=>e.currentTarget.style.borderColor=C.gold} onMouseLeave={e=>e.currentTarget.style.borderColor=C.borderDefault}>
              <X size={10} color={C.textSecondary}/>
            </button>
          </div>
          {queueCount>1&&<div style={{ padding:"5px 10px",borderRadius:6,marginBottom:10,background:C.goldFaint,border:`1px solid ${C.borderAccent}`,fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.12em",color:C.gold,textTransform:"uppercase" }}>{queueCount} reminders queued</div>}
          <div style={{ maxHeight:180,overflowY:"auto" }}>
            {items.map((item,idx)=>{
              const dt=parseEventDate(item.eventDate,item.eventTime),diff=dt?dt.getTime()-nowMs:null;
              const rel=diff!==null&&diff>0?relLabel(diff)+" to event":diff!==null?"Event started":null,urgent=diff!==null&&diff<=30*60000;
              return (
                <div key={idx} style={{ marginBottom:idx<items.length-1?10:0,paddingBottom:idx<items.length-1?10:0,borderBottom:idx<items.length-1?`1px solid ${C.divider}`:"none" }}>
                  <div style={{ fontFamily:F.body,fontSize:13,fontWeight:600,color:C.textPrimary,marginBottom:3 }}>{item.name}</div>
                  <div style={{ fontFamily:F.body,fontSize:11.5,color:C.textSecondary,marginBottom:rel?6:0 }}>{fmtDate(item.eventDate)} · {fmtTime(item.eventTime)}{item.room?` · ${item.room}`:""}</div>
                  {rel&&<span style={{ background:urgent?C.redFaint:C.goldFaint,border:`1px solid ${urgent?C.redBorder:C.borderAccent}`,borderRadius:4,padding:"2px 8px",fontSize:9,fontWeight:700,fontFamily:F.label,letterSpacing:"0.10em",textTransform:"uppercase",color:urgent?C.red:C.gold,display:"inline-block" }}>{rel}</span>}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ borderTop:`1px solid ${C.divider}`,display:"grid",gridTemplateColumns:canAcknowledge?"1fr 1fr":"1fr" }}>
          <button onClick={()=>onView(popup)} style={{ padding:"13px 0",background:"transparent",border:"none",borderRight:`1px solid ${C.divider}`,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.green,cursor:"pointer",transition:"background 0.18s" }} onMouseEnter={e=>e.currentTarget.style.background=C.greenFaint} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>View</button>
          {canAcknowledge&&<button onClick={()=>onAcknowledge(popup)} style={{ padding:"13px 0",background:"transparent",border:"none",fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.gold,cursor:"pointer",transition:"background 0.18s" }} onMouseEnter={e=>e.currentTarget.style.background=C.goldFaint} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>Acknowledge</button>}
        </div>
      </div>
    </div>
  );
}

// ─── Reservation Card ─────────────────────────────────────────────────────────
function ReservationCard({ res, isNew, onClick, onApprove, onDecline, approvingIds, decliningIds, canManage, C }) {
  const [hi,setHi]=useState(isNew);
  useEffect(()=>{ if(isNew){const t=setTimeout(()=>setHi(false),4000);return()=>clearTimeout(t);} },[isNew]);
  const rawStatus=(res.status||"").toLowerCase(),resIsPending=rawStatus==="pending";
  const resId=res.id??res.db_id,isApprovingThis=approvingIds?.has(resId),isDecliningThis=decliningIds?.has(resId);
  const outletName = getOutletName(res);
  return (
    <div style={{ background:hi?C.goldFaintest:C.cardBg,border:`1px solid ${hi?C.borderAccent:C.cardBorder}`,borderRadius:10,padding:"15px 16px",marginBottom:8,boxShadow:hi?`0 0 0 3px ${C.goldFaint}`:"none",transition:"all 0.30s ease",animation:isNew?"cardSlideIn 0.40s cubic-bezier(0.34,1.5,0.64,1)":"none",cursor:"pointer" }} onClick={()=>onClick(res)} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.borderAccent;e.currentTarget.style.background=C.goldFaintest;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=hi?C.borderAccent:C.cardBorder;e.currentTarget.style.background=hi?C.goldFaintest:C.cardBg;}}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,gap:10 }}>
        <div style={{ fontFamily:F.body,fontSize:13.5,fontWeight:600,color:C.textPrimary,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{res.guest_name||res.name||"Unknown Guest"}</div>
        <span style={{ display:"inline-flex",alignItems:"center",gap:5,maxWidth:180,background:C.goldFaintest,border:`1px solid ${C.borderAccent}`,borderRadius:4,padding:"4px 8px",fontFamily:F.label,fontSize:8.5,fontWeight:800,letterSpacing:"0.10em",textTransform:"uppercase",color:C.gold,overflow:"hidden",whiteSpace:"nowrap" }}>
          <MapPin size={9} style={{ flexShrink:0 }}/>
          <span style={{ overflow:"hidden",textOverflow:"ellipsis" }}>{outletName}</span>
        </span>
        <StatusBadge status={rawStatus} C={C}/>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"5px 8px" }}>
        {[
          {icon:<MapPin size={10}/>,      val:outletName},
          {icon:<CalendarDays size={10}/>,val:fmtDate(res.event_date||res.eventDate||res.reservationDate)},
          {icon:<Clock size={10}/>,       val:fmtTime(res.event_time||res.eventTime||res.reservationTime)},
          {icon:<FileText size={10}/>,    val:res.table_number??res.table?`Table ${res.table_number||res.table}`:"No table"},
          {icon:<Users size={10}/>,       val:(res.guests_count||res.guests||1)>0?`${res.guests_count||res.guests||1} pax`:"1 pax"},
          {icon:<Hash size={10}/>,        val:res.reference_code||res.id},
        ].map(({icon,val},i)=>val&&(
          <div key={i} style={{ display:"flex",alignItems:"center",gap:5,overflow:"hidden" }}>
            <span style={{ color:C.textTertiary,flexShrink:0 }}>{icon}</span>
            <span style={{ fontFamily:F.body,fontSize:11,color:C.textSecondary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{val}</span>
          </div>
        ))}
      </div>
      {resIsPending&&onApprove&&canManage&&(
        <div style={{ marginTop:12,paddingTop:10,borderTop:`1px solid ${C.divider}`,display:"grid",gridTemplateColumns:"1fr 1.4fr",gap:8 }}>
          <button onClick={e=>{e.stopPropagation();onDecline(res);}} disabled={isApprovingThis||isDecliningThis} style={{ width:"100%",padding:"9px",background:"transparent",border:`1px solid ${C.redBorder}`,borderRadius:8,fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:C.red,cursor:isApprovingThis||isDecliningThis?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"all 0.18s" }}>
            {isDecliningThis?<><Spinner C={C} size={11}/>Declining...</>:<><XCircle size={11}/>Decline</>}
          </button>
          <button onClick={e=>{e.stopPropagation();onApprove(res);}} disabled={isApprovingThis} style={{ width:"100%",padding:"9px",background:isApprovingThis?C.green+"80":C.green,border:"none",borderRadius:8,fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:"#fff",cursor:isApprovingThis?"not-allowed":"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:7,transition:"all 0.18s" }} onMouseEnter={e=>{if(!isApprovingThis)e.currentTarget.style.opacity="0.85";}} onMouseLeave={e=>{if(!isApprovingThis)e.currentTarget.style.opacity="1";}}>
            {isApprovingThis?<><Spinner C={C} size={11}/>Approving…</>:<><ThumbsUp size={11}/>Approve Reservation</>}
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Done Card ────────────────────────────────────────────────────────────────
function DoneCard({ res, onClick, C }) {
  const outletName = getOutletName(res);
  return (
    <div onClick={()=>onClick(res)} style={{ background:C.cardBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"13px 15px",marginBottom:8,cursor:"pointer",transition:"all 0.18s" }} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.green;e.currentTarget.style.background=C.greenFaint;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.greenBorder;e.currentTarget.style.background=C.cardBg;}}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7,gap:8 }}>
        <div style={{ fontFamily:F.body,fontSize:13,fontWeight:600,color:C.textPrimary,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{res.guest_name||res.name||"Unknown Guest"}</div>
        <span style={{ display:"inline-flex",alignItems:"center",gap:5,maxWidth:150,background:C.goldFaintest,border:`1px solid ${C.borderAccent}`,borderRadius:4,padding:"3px 7px",fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.10em",textTransform:"uppercase",color:C.gold,overflow:"hidden",whiteSpace:"nowrap" }}>
          <MapPin size={8} style={{ flexShrink:0 }}/>
          <span style={{ overflow:"hidden",textOverflow:"ellipsis" }}>{outletName}</span>
        </span>
        <StatusBadge status={res.status} C={C}/>
      </div>
      <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
        {[fmtDate(res.event_date||res.eventDate||res.reservationDate),fmtTime(res.event_time||res.eventTime||res.reservationTime),outletName].filter(Boolean).map((v,i)=>(
          <span key={i} style={{ fontFamily:F.body,fontSize:11,color:C.textSecondary }}>{v}</span>
        ))}
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────
function Pagination({ page, total, perPage, setPage, setPerPage, C }) {
  const totalPages = Math.ceil(total / perPage);
  if (total <= 10) return null;
  const from = Math.min((page - 1) * perPage + 1, total);
  const to = Math.min(page * perPage, total);
  return (
    <div style={{ padding: "10px 16px", borderTop: `1px solid ${C.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, gap: 8, flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontFamily: F.label, fontSize: 11, color: C.textSecondary }}>{from}–{to} of {total}</span>
        <select value={perPage} onChange={e => { setPerPage(Number(e.target.value)); setPage(1); }} style={{ padding: "4px 6px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, fontSize: 11, fontFamily: F.label, color: C.textSecondary, background: C.surfaceInput, cursor: "pointer", outline: "none" }}>
          {[10, 20, 50].map(n => <option key={n} value={n}>{n} / page</option>)}
        </select>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} style={{ padding: "5px 10px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, background: "transparent", fontFamily: F.label, fontSize: 11, color: page <= 1 ? C.textTertiary : C.textSecondary, cursor: page <= 1 ? "not-allowed" : "pointer", opacity: page <= 1 ? 0.4 : 1 }}>‹ Prev</button>
        {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
          let p;
          if (totalPages <= 5) p = i + 1;
          else if (page <= 3) p = i + 1;
          else if (page >= totalPages - 2) p = totalPages - 4 + i;
          else p = page - 2 + i;
          return (
            <button key={p} onClick={() => setPage(p)} style={{ width: 30, height: 30, border: `1px solid ${p === page ? C.gold : C.borderDefault}`, borderRadius: 6, background: p === page ? C.goldFaint : "transparent", fontFamily: F.mono, fontSize: 11, fontWeight: p === page ? 700 : 400, color: p === page ? C.gold : C.textSecondary, cursor: "pointer" }}>{p}</button>
          );
        })}
        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ padding: "5px 10px", border: `1px solid ${C.borderDefault}`, borderRadius: 6, background: "transparent", fontFamily: F.label, fontSize: 11, color: page >= totalPages ? C.textTertiary : C.textSecondary, cursor: page >= totalPages ? "not-allowed" : "pointer", opacity: page >= totalPages ? 0.4 : 1 }}>Next ›</button>
      </div>
    </div>
  );
}

function EmptyState({ msg, C }) {
  return <div style={{ textAlign:"center",padding:"50px 20px",fontFamily:F.label,fontSize:9,letterSpacing:"0.18em",color:C.textTertiary,textTransform:"uppercase",fontWeight:700 }}>{msg}</div>;
}

function OutletMonitorBar({ outlets, selectedOutlet, onSelect, currentUser, C }) {
  const [query,setQuery]=useState("");
  const [groupFilter,setGroupFilter]=useState("ALL");
  const visibleLabel = currentUser?.scope_type === "assigned"
    ? "Assigned outlet view"
    : "All outlet view";
  const totalPending = outlets.reduce((sum, outlet) => sum + outlet.pending, 0);
  const totalUpcoming = outlets.reduce((sum, outlet) => sum + outlet.upcoming, 0);
  const totalReservations = outlets.reduce((sum, outlet) => sum + outlet.total, 0);
  const selectedSummary = selectedOutlet === "ALL"
    ? { outlet:"All Outlets", total:totalReservations, pending:totalPending, upcoming:totalUpcoming }
    : outlets.find(outlet => outlet.outlet === selectedOutlet) || { outlet:selectedOutlet, total:0, pending:0, upcoming:0 };
  const outletByName = new Map(outlets.map(outlet => [outlet.outlet, outlet]));
  const groupedNames = new Set(ADMIN_OUTLET_GROUPS.flatMap(group => group.rooms));
  const groupedOutlets = ADMIN_OUTLET_GROUPS.map(group => ({
    ...group,
    items: group.rooms
      .map(room => outletByName.get(room))
      .filter(Boolean),
  })).filter(group => group.items.length > 0);
  const otherOutlets = outlets.filter(outlet => !groupedNames.has(outlet.outlet));
  const browseGroups = [...groupedOutlets, ...(otherOutlets.length ? [{ id:"other",label:"Other Outlets",items:otherOutlets }] : [])];
  const visibleBrowseGroups = groupFilter === "ALL" ? browseGroups : browseGroups.filter(group => group.id === groupFilter);
  const searchablePool = visibleBrowseGroups.flatMap(group => group.items);
  const searchValue = query.trim().toLowerCase();
  const searchResults = searchValue
    ? searchablePool.filter(outlet => outlet.outlet.toLowerCase().includes(searchValue)).slice(0, 10)
    : [];

  return (
    <Panel C={C} accentColor={totalPending ? C.gold : C.green} style={{ flexShrink:0 }}>
      <div style={{ padding:"10px 14px",display:"grid",gap:10 }}>
        <div style={{ display:"grid",gridTemplateColumns:"minmax(220px, 1fr) minmax(320px, 1.7fr) auto",gap:10,alignItems:"center" }} className="nd-routing-toolbar">
          <div style={{ minWidth:0 }}>
            <div style={{ display:"flex",alignItems:"center",gap:8,marginBottom:3 }}>
              <span style={{ width:16,height:1,background:C.gold,flexShrink:0 }} />
              <span style={{ fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.17em",textTransform:"uppercase",color:C.gold }}>Inter-Outlet Routing</span>
            </div>
            <div style={{ fontFamily:F.body,fontSize:12,color:C.textSecondary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>
              {visibleLabel} - {selectedSummary.outlet}
            </div>
          </div>

          <div style={{ display:"grid",gridTemplateColumns:"minmax(160px, 0.9fr) minmax(180px, 1fr)",gap:8,minWidth:0 }}>
            <select
              value={selectedOutlet}
              onChange={e=>onSelect(e.target.value)}
              style={{ height:36,minWidth:0,padding:"0 10px",border:`1px solid ${C.borderDefault}`,borderRadius:8,background:C.surfaceBase,fontFamily:F.body,fontSize:12,color:C.textPrimary,outline:"none" }}
            >
              <option value="ALL">All Outlets</option>
              {groupedOutlets.map(group=>(
                <optgroup key={group.id} label={`${group.label} (${group.items.length})`}>
                  {group.items.map(outlet=><option key={outlet.outlet} value={outlet.outlet}>{outlet.outlet}</option>)}
                </optgroup>
              ))}
              {otherOutlets.length>0&&(
                <optgroup label={`Other Outlets (${otherOutlets.length})`}>
                  {otherOutlets.map(outlet=><option key={outlet.outlet} value={outlet.outlet}>{outlet.outlet}</option>)}
                </optgroup>
              )}
            </select>
            <label style={{ height:36,display:"flex",alignItems:"center",gap:8,padding:"0 10px",border:`1px solid ${C.borderDefault}`,borderRadius:8,background:C.surfaceInput,minWidth:0 }}>
              <Search size={13} color={C.textTertiary}/>
              <input
                value={query}
                onChange={e=>setQuery(e.target.value)}
                placeholder="Search outlets"
                style={{ flex:1,minWidth:0,border:"none",outline:"none",background:"transparent",fontFamily:F.body,fontSize:12,color:C.textPrimary }}
              />
            </label>
          </div>

          <div style={{ display:"flex",justifyContent:"flex-end",gap:6,flexWrap:"wrap" }}>
            <RoutingMetric label="Pending" value={selectedSummary.pending} color={C.gold} bg={C.goldFaint} border={C.borderAccent} C={C}/>
            <RoutingMetric label="Upcoming" value={selectedSummary.upcoming} color={C.blue} bg={C.blueFaint} border={C.blueBorder} C={C}/>
            <RoutingMetric label="Total" value={selectedSummary.total} color={C.textSecondary} bg="rgba(0,0,0,0.03)" border={C.borderDefault} C={C}/>
          </div>
        </div>

        <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
          <GroupFilterButton active={groupFilter==="ALL"} label="All Groups" count={outlets.length} onClick={()=>setGroupFilter("ALL")} C={C}/>
          {browseGroups.map(group=>(
            <GroupFilterButton
              key={group.id}
              active={groupFilter===group.id}
              label={group.label}
              count={group.items.length}
              onClick={()=>setGroupFilter(group.id)}
              C={C}
            />
          ))}
        </div>

        {searchValue&&(
          <div style={{ border:`1px solid ${C.borderDefault}`,borderRadius:8,background:"rgba(255,255,255,0.74)",overflow:"hidden" }}>
            {searchResults.length===0 ? (
              <div style={{ padding:"10px 12px",fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary }}>No outlets match your search</div>
            ) : (
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(190px, 1fr))",gap:0,maxHeight:126,overflowY:"auto" }}>
                {searchResults.map(outlet=>(
                  <CompactOutletButton
                    key={outlet.outlet}
                    outlet={outlet}
                    active={selectedOutlet === outlet.outlet}
                    onClick={()=>onSelect(outlet.outlet)}
                    C={C}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <details style={{ border:`1px solid ${C.divider}`,borderRadius:8,background:"rgba(255,255,255,0.42)",overflow:"hidden" }}>
          <summary style={{ listStyle:"none",cursor:"pointer",padding:"8px 10px",fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textSecondary,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10 }}>
            <span>Browse Grouped Outlets</span>
            <span style={{ fontFamily:F.mono,fontSize:10,color:C.textTertiary }}>{visibleBrowseGroups.reduce((sum, group)=>sum+group.items.length,0)} visible</span>
          </summary>
          <div style={{ padding:"0 10px 10px",display:"grid",gridTemplateColumns:"repeat(auto-fit, minmax(180px, 1fr))",gap:8 }}>
            {visibleBrowseGroups.map(group=>(
              <div key={group.id} style={{ border:`1px solid ${C.borderDefault}`,borderRadius:8,background:C.surfaceBase,overflow:"hidden" }}>
                <div style={{ padding:"7px 9px",borderBottom:`1px solid ${C.divider}`,fontFamily:F.label,fontSize:8.5,fontWeight:800,letterSpacing:"0.13em",textTransform:"uppercase",color:C.gold,display:"flex",justifyContent:"space-between" }}>
                  <span>{group.label}</span><span>{group.items.length}</span>
                </div>
                <div style={{ display:"grid" }}>
                  {group.items.map(outlet=>(
                    <CompactOutletButton key={outlet.outlet} outlet={outlet} active={selectedOutlet===outlet.outlet} onClick={()=>onSelect(outlet.outlet)} C={C}/>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </details>
      </div>
    </Panel>
  );
}

function RoutingMetric({ label, value, color, bg, border, C }) {
  return (
    <div style={{ minWidth:76,padding:"5px 8px",border:`1px solid ${border}`,borderRadius:8,background:bg,display:"flex",alignItems:"center",justifyContent:"space-between",gap:8 }}>
      <div style={{ fontFamily:F.label,fontSize:8,fontWeight:800,letterSpacing:"0.12em",textTransform:"uppercase",color:C.textTertiary }}>{label}</div>
      <div style={{ fontFamily:F.display,fontSize:15,fontWeight:700,color,lineHeight:1 }}>{value}</div>
    </div>
  );
}

function GroupFilterButton({ active, label, count, onClick, C }) {
  return (
    <button
      onClick={onClick}
      style={{ height:28,display:"inline-flex",alignItems:"center",gap:7,padding:"0 9px",border:`1px solid ${active?C.borderAccent:C.borderDefault}`,borderRadius:999,background:active?C.goldFaint:C.surfaceBase,color:active?C.gold:C.textSecondary,fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.09em",textTransform:"uppercase",cursor:"pointer",transition:"all 0.18s" }}
    >
      <span>{label}</span>
      <span style={{ minWidth:18,height:18,padding:"0 5px",borderRadius:999,display:"inline-flex",alignItems:"center",justifyContent:"center",background:active?"rgba(140,107,42,0.12)":"rgba(0,0,0,0.035)",fontFamily:F.mono,fontSize:10,letterSpacing:0 }}>{count}</span>
    </button>
  );
}

function CompactOutletButton({ outlet, active, onClick, C }) {
  return (
    <button
      onClick={onClick}
      style={{
        width:"100%",
        display:"flex",
        alignItems:"center",
        justifyContent:"space-between",
        gap:10,
        minHeight:34,
        padding:"7px 9px",
        border:"none",
        borderBottom:`1px solid ${C.divider}`,
        background:active ? C.goldFaintest : "transparent",
        color:active ? C.gold : C.textPrimary,
        cursor:"pointer",
        textAlign:"left",
        transition:"all 0.18s",
      }}
      onMouseEnter={e=>{if(!active)e.currentTarget.style.background="rgba(140,107,42,0.045)";}}
      onMouseLeave={e=>{if(!active)e.currentTarget.style.background="transparent";}}
    >
      <span style={{ minWidth:0,display:"flex",alignItems:"center",gap:7 }}>
        <MapPin size={11} color={active?C.gold:C.textTertiary} style={{ flexShrink:0 }}/>
        <span style={{ minWidth:0,fontFamily:F.body,fontSize:11.5,fontWeight:active?700:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{outlet.outlet}</span>
      </span>
      <span style={{ flexShrink:0,fontFamily:F.mono,fontSize:10,color:outlet.pending?C.gold:C.textTertiary }}>
        {outlet.pending}/{outlet.total}
      </span>
    </button>
  );
}
function Toast({ toasts, C }) {
  return (
    <div style={{ position:"fixed",bottom:24,right:24,zIndex:20000,display:"flex",flexDirection:"column",gap:8,pointerEvents:"none" }}>
      {toasts.map(t=>(
        <div key={t.id} style={{ background:C.surfaceBase,borderRadius:10,padding:"12px 18px",fontFamily:F.body,fontSize:13,fontWeight:500,boxShadow:"0 8px 32px rgba(0,0,0,0.20)",display:"flex",alignItems:"center",gap:10,animation:"modalIn 0.28s cubic-bezier(0.16,1,0.3,1)",border:`1px solid ${t.type==="success"?C.greenBorder:C.redBorder}`,color:C.textPrimary,minWidth:240 }}>
          {t.type==="success"?<CheckCircle size={14} color={C.green}/>:<X size={14} color={C.red}/>}{t.message}
        </div>
      ))}
    </div>
  );
}

function TabBtn({ active, onClick, children, activeColor, count, pulse, C }) {
  return (
    <button onClick={onClick} style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 12px",background:active?activeColor+"18":"transparent",border:`1px solid ${active?activeColor+"50":C.borderDefault}`,borderRadius:6,cursor:"pointer",transition:"all 0.18s",fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:active?activeColor:C.textSecondary }} onMouseEnter={e=>{if(!active){e.currentTarget.style.borderColor=C.borderAccent;e.currentTarget.style.color=C.gold;}}} onMouseLeave={e=>{if(!active){e.currentTarget.style.borderColor=C.borderDefault;e.currentTarget.style.color=C.textSecondary;}}}>
      {children}
      <span style={{ background:active?activeColor+"25":C.goldFaint,border:`1px solid ${active?activeColor+"40":C.borderDefault}`,borderRadius:4,padding:"1px 6px",fontSize:9,fontWeight:700,color:active?activeColor:C.textTertiary }}>{count}</span>
      {pulse&&!active&&<span style={{ width:5,height:5,borderRadius:"50%",background:C.red,animation:"dotPulse 1.2s ease infinite" }}/>}
    </button>
  );
}

function Panel({ children, accentColor, C, style={} }) {
  const color=accentColor||C.gold;
  return (
    <div style={{ background:C.surfaceBase,borderRadius:14,border:`1px solid ${C.borderDefault}`,overflow:"hidden",display:"flex",flexDirection:"column",minHeight:0,...style }}>
      <div style={{ height:"2px",background:`linear-gradient(90deg,transparent,${color}80 30%,${color}80 70%,transparent)`,flexShrink:0 }}/>
      {children}
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────
function AcknowledgmentMonitor({ activeAlerts, acknowledgedAlerts, onAcknowledge, canAcknowledge, C }) {
  return (
    <Panel C={C} accentColor={activeAlerts.length ? C.gold : C.green} style={{ flexShrink:0 }}>
      <div style={{ padding:"12px 16px 10px",borderBottom:`1px solid ${C.divider}` }}>
        <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,flexWrap:"wrap" }}>
          <div style={{ display:"flex",alignItems:"center",gap:8 }}>
            <BellDot size={13} color={activeAlerts.length ? C.gold : C.green}/>
            <span style={{ fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:activeAlerts.length ? C.gold : C.green }}>Acknowledgment Monitor</span>
          </div>
          <div style={{ display:"flex",gap:6,flexWrap:"wrap" }}>
            <span style={{ background:C.goldFaint,border:`1px solid ${C.borderAccent}`,borderRadius:4,padding:"3px 8px",fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:C.gold }}>{activeAlerts.length} Unacknowledged</span>
            <span style={{ background:C.greenFaint,border:`1px solid ${C.greenBorder}`,borderRadius:4,padding:"3px 8px",fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",color:C.green }}>{acknowledgedAlerts.length} Acknowledged</span>
          </div>
        </div>
      </div>
      <div style={{ padding:"10px 12px",display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(280px,1fr))",gap:8 }}>
        {activeAlerts.length===0 ? (
          <div style={{ fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.16em",textTransform:"uppercase",color:C.textTertiary,padding:"10px 4px" }}>No active alerts needing acknowledgment</div>
        ) : activeAlerts.slice(0,4).map(alert=>(
          <div key={alert.id} style={{ border:`1px solid ${C.borderAccent}`,borderRadius:8,padding:"10px 12px",background:C.goldFaintest,display:"flex",alignItems:"center",justifyContent:"space-between",gap:12 }}>
            <div style={{ minWidth:0 }}>
              <div style={{ fontFamily:F.body,fontSize:12.5,fontWeight:700,color:C.textPrimary,marginBottom:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{alert.name}</div>
              <div style={{ fontFamily:F.body,fontSize:11,color:C.textSecondary,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{alert.room} - {fmtDate(alert.eventDate)} - {fmtTime(alert.eventTime)}</div>
            </div>
            {canAcknowledge&&<button onClick={()=>onAcknowledge([alert])} title="Acknowledge alert" style={{ flex:"0 0 auto",padding:"7px 12px",border:`1px solid ${C.borderAccent}`,borderRadius:6,background:C.gold,color:"#fff",fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.12em",textTransform:"uppercase",cursor:"pointer",whiteSpace:"nowrap" }}>Acknowledge</button>}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function NotificationDashboard() {
  const { isDark } = useAdminTheme();
  const C=getTokens();
  const navigate = useNavigate();
  const currentUser = useMemo(()=>authAPI.getCurrentUser(),[]);
  const canManageReservations = authAPI.hasPermission("manage_reservations");
  const canAcknowledgeNotifications = authAPI.hasPermission("acknowledge_notifications");

  const [allCards,setAllCards]=useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  // New filters state
  const [filterType, setFilterType] = useState("ALL");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterSearch, setFilterSearch] = useState("");
  const [filterDateStart, setFilterDateStart] = useState("");
  const [filterDateEnd, setFilterDateEnd] = useState("");

  // Pagination state
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  const [popupQueue,setPopupQueue]=useState([]);
  const popup=popupQueue[0]??null;
  const [pickerItems,setPickerItems]=useState(null);
  const [detailRes,setDetailRes]=useState(null);
  const [newIds,setNewIds]=useState(new Set());
  const [clock,setClock]=useState(clockStr());
  const [date,setDate]=useState(dateStr());
  const [loading,setLoading]=useState(true);
  const [wsStatus,setWsStatus]=useState("connecting");
  const [approvingIds,setApprovingIds]=useState(new Set());
  const [decliningIds,setDecliningIds]=useState(new Set());
  const [confirmRes,setConfirmRes]=useState(null);
  const [declineRes,setDeclineRes]=useState(null);
  const [isApproving,setIsApproving]=useState(false);
  const [isDeclining,setIsDeclining]=useState(false);
  const [toasts,setToasts]=useState([]);
  const [pendingPage,setPendingPage]=useState(1);
  const [donePage,setDonePage]=useState(1);
  const [pendingPerPage,setPendingPerPage]=useState(20);
  const [donePerPage,setDonePerPage]=useState(20);
  const [leftTab,setLeftTab]=useState("pending");
  const [rightTab,setRightTab]=useState("accepted");
  const [outletFilter,setOutletFilter]=useState("ALL");
  const [acknowledgments,setAcknowledgments]=useState(()=>loadAcknowledgments());

  const knownIds=useRef(new Set()),firedAlerts=useRef(new Set()),leftRef=useRef(null);
  const echoRef=useRef(null),reconnectDelay=useRef(2000),reconnectTimer=useRef(null),isMounted=useRef(true);
  const reconnectAttempts=useRef([]),pollTimer=useRef(null),recoveryTimer=useRef(null);

  // Helper to determine if a reservation is read
  const isRead = useCallback((res) => {
    if (!res.seen_by) return false;
    const key = String(currentUser?.id || currentUser?.email || currentUser?.name || "");
    if (!key) return false;
    return !!res.seen_by[key];
  }, [currentUser]);

  // Derive detailed notification state
  const getNotificationDetails = useCallback((res) => {
    const status = (res.status || "").toLowerCase().trim();
    const isRoomAssigned = !!(res.room || res.venue?.name || res.venue) && (res.room || res.venue?.name || res.venue) !== "Unassigned Outlet";
    const hasBeenUpdated = Array.isArray(res.transaction_history) && res.transaction_history.some(h => h.action === "reservation_updated" || h.action === "details_adjusted");
    
    if (status === "pending") {
      if (!isRoomAssigned) {
        return {
          type: "room_assignment_needed",
          label: "Room Assignment Needed",
          color: C.red,
          description: `New request from ${res.guest_name || res.name || "Guest"} needs room assignment.`
        };
      }
      return {
        type: "new_request",
        label: "New Request",
        color: C.gold,
        description: `${res.guest_name || res.name || "Guest"} requested a booking.`
      };
    }
    if (status === "cancelled" || status === "canceled") {
      return {
        type: "cancelled",
        label: "Cancelled by Guest",
        color: C.red,
        description: `${res.guest_name || res.name || "Guest"} cancelled their booking.`
      };
    }
    if (hasBeenUpdated) {
      return {
        type: "updated",
        label: "Updated by Guest",
        color: C.blue,
        description: `${res.guest_name || res.name || "Guest"} updated booking details.`
      };
    }
    if (status === "reserved" || status === "approved" || status === "confirmed") {
      return {
        type: "approved",
        label: "Approved",
        color: C.green,
        description: `Booking confirmed for ${res.guest_name || res.name || "Guest"}.`
      };
    }
    if (status === "rejected" || status === "declined") {
      return {
        type: "rejected",
        label: "Declined",
        color: C.slate,
        description: `Booking declined for ${res.guest_name || res.name || "Guest"}.`
      };
    }
    return {
      type: "info",
      label: "Update",
      color: C.slate,
      description: `Status updated for ${res.guest_name || res.name || "Guest"}.`
    };
  }, [C]);

  // Derived Notifications respect scoping & formatting
  const derivedNotifications = useMemo(() => {
    return allCards
      .filter(res => {
        // filter by scope using canAccessOutlet
        const outlet = canonicalOutletName(res.room || res.venue?.name || res.venue || "Unassigned Outlet");
        return canAccessOutlet(currentUser, outlet) && (outletFilter === "ALL" || outlet === outletFilter);
      })
      .map(res => {
        const details = getNotificationDetails(res);
        const read = isRead(res);
        const outlet = getOutletName(res);
        const timestamp = new Date(res.created_at || res.submitted_timestamp || res.updated_at || Date.now());
        
        // Calculate alert urgency/acknowledgment needed
        const dt = parseEventDate(res.event_date || res.eventDate || res.reservationDate, res.event_time || res.eventTime || res.reservationTime);
        const now = Date.now();
        const diff = dt ? dt.getTime() - now : null;
        const isAlert = (res.status === "approved" || res.status === "reserved" || res.status === "confirmed") && 
                        diff !== null && diff > 0 && diff <= 2 * 3600000;
        
        return {
          res,
          id: res.id ?? res.db_id,
          db_id: res.db_id,
          guest_name: res.guest_name || res.name || "Guest",
          outlet,
          eventDate: res.event_date || res.eventDate || res.reservationDate,
          eventTime: res.event_time || res.eventTime || res.reservationTime,
          guestsCount: res.guests_count || res.guests || 1,
          referenceCode: res.reference_code || res.id,
          status: res.status,
          timestamp,
          read,
          details,
          isAlert,
          needsAck: isAlert && !acknowledgments[String(res.id ?? res.db_id)] && canAcknowledgeNotifications
        };
      });
  }, [allCards, currentUser, outletFilter, getNotificationDetails, isRead, acknowledgments, canAcknowledgeNotifications]);

  // Filtered Notifications list
  const filteredNotifications = useMemo(() => {
    const searchVal = filterSearch.trim().toLowerCase();
    
    return derivedNotifications.filter(item => {
      // 1. Filter by Type
      if (filterType !== "ALL" && item.details.type !== filterType) return false;
      
      // 2. Filter by Status
      if (filterStatus !== "ALL" && String(item.status).toLowerCase() !== filterStatus.toLowerCase()) return false;
      
      // 3. Filter by Date range (on eventDate)
      if (filterDateStart) {
        const itemDate = new Date(item.eventDate);
        const startDate = new Date(filterDateStart);
        if (itemDate < startDate) return false;
      }
      if (filterDateEnd) {
        const itemDate = new Date(item.eventDate);
        const endDate = new Date(filterDateEnd);
        endDate.setHours(23, 59, 59, 999); // include the whole end day
        if (itemDate > endDate) return false;
      }
      
      // 4. Search query
      if (searchVal) {
        const matchesName = String(item.guest_name).toLowerCase().includes(searchVal);
        const matchesRef = String(item.referenceCode).toLowerCase().includes(searchVal);
        const matchesOutlet = String(item.outlet).toLowerCase().includes(searchVal);
        if (!matchesName && !matchesRef && !matchesOutlet) return false;
      }
      
      return true;
    });
  }, [derivedNotifications, filterType, filterStatus, filterDateStart, filterDateEnd, filterSearch]);

  // Paginated visible list
  const paginatedNotifications = useMemo(() => {
    return filteredNotifications.slice((page - 1) * perPage, page * perPage);
  }, [filteredNotifications, page, perPage]);

  // Group paginated items by Date (Today, Yesterday, Older)
  const paginatedGroupedNotifications = useMemo(() => {
    const todayStr = new Date().toLocaleDateString("en-US");
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString("en-US");
    
    const groups = {
      today: [],
      yesterday: [],
      older: []
    };
    
    paginatedNotifications.forEach(item => {
      const dateStr = new Date(item.timestamp).toLocaleDateString("en-US");
      if (dateStr === todayStr) {
        groups.today.push(item);
      } else if (dateStr === yesterdayStr) {
        groups.yesterday.push(item);
      } else {
        groups.older.push(item);
      }
    });
    
    return groups;
  }, [paginatedNotifications]);

  // Calculate summary counts (Pending, Unread, Acknowledged, Total)
  const notificationCounts = useMemo(() => {
    const pending = derivedNotifications.filter(n => n.status === "pending").length;
    const unread = derivedNotifications.filter(n => !n.read).length;
    const acknowledged = Object.keys(acknowledgments).length;
    const total = derivedNotifications.length;
    
    return { pending, unread, acknowledged, total };
  }, [derivedNotifications, acknowledgments]);

  const markAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await reservationAPI.markSeen(id);
      const now = new Date().toISOString();
      const key = String(currentUser.id || currentUser.email || currentUser.name || "");
      
      setAllCards(prev => prev.map(r => {
        if ((r.id === id || r.db_id === id)) {
          const seenBy = r.seen_by ? { ...r.seen_by } : {};
          seenBy[key] = {
            id: currentUser.id || null,
            name: currentUser.name || null,
            role: currentUser.role || null,
            seen_at: now
          };
          return { ...r, seen_by: seenBy };
        }
        return r;
      }));
      window.dispatchEvent(new CustomEvent("bellevue:notifications-changed"));
    } catch (err) {
      console.warn("Failed to mark notification as read", err);
    }
  };

  const markAllAsRead = async () => {
    const unread = derivedNotifications.filter(n => !n.read);
    if (!unread.length) return;
    try {
      await Promise.all(unread.map(n => reservationAPI.markSeen(n.db_id)));
      const now = new Date().toISOString();
      const key = String(currentUser.id || currentUser.email || currentUser.name || "");
      
      setAllCards(prev => prev.map(r => {
        const rId = r.id ?? r.db_id;
        const wasUnread = unread.some(n => n.id === rId);
        if (wasUnread) {
          const seenBy = r.seen_by ? { ...r.seen_by } : {};
          seenBy[key] = {
            id: currentUser.id || null,
            name: currentUser.name || null,
            role: currentUser.role || null,
            seen_at: now
          };
          return { ...r, seen_by: seenBy };
        }
        return r;
      }));
      window.dispatchEvent(new CustomEvent("bellevue:notifications-changed"));
      addToast("All notifications marked as read.", "success");
    } catch (err) {
      console.warn("Failed to mark all notifications as read", err);
    }
  };

  const handleCardClick = async (item) => {
    setDetailRes(item.res);
    if (!item.read) {
      await markAsRead(item.db_id);
    }
  };

  useEffect(()=>{isMounted.current=true;return()=>{isMounted.current=false;};},[]);
  const addToast=useCallback((message,type="success")=>{const id=Date.now();setToasts(p=>[...p,{id,message,type}]);setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3500);},[]);
  const dismissPopup=useCallback(()=>{setPopupQueue(q=>{const next=q.slice(1);if(!next.length)stopAlert();return next;});},[]);
  const syncAcknowledgments=useCallback(async()=>{
    try{
      const resp=await reservationAPI.getAcknowledgments();
      const shared=normalizeAcknowledgments(resp?.data||resp||[]);
      setAcknowledgments(shared);
      localStorage.setItem(ACK_STORAGE_KEY,JSON.stringify(shared));
    }catch{}
  },[]);

  useEffect(()=>{syncAcknowledgments();},[syncAcknowledgments]);

  const acknowledgeAlerts=useCallback(async(alerts)=>{
    const items=Array.isArray(alerts)?alerts:(alerts?.items||[]);
    if(!items.length)return;
    const now=new Date().toISOString();
    const payloadItems=items.map(item=>{
      const id=notificationId(item);
      const reservationId=Number(item.db_id||item.reservation_id||item.reservationId);
      return {
        notification_key:id,
        reservation_id:Number.isFinite(reservationId)&&reservationId>0?reservationId:null,
        outlet:item.room||item.outlet||"",
        event_date:item.eventDate||item.event_date,
        event_time:item.eventTime||item.event_time,
        metadata:{name:item.name||item.guest_name||"Reservation"},
      };
    }).filter(item=>item.notification_key);

    setAcknowledgments(prev=>{
      const next={...prev};
      items.forEach(item=>{
        const id=notificationId(item);
        if(id)next[id]={id,name:item.name||item.guest_name||"Reservation",room:item.room||"",eventDate:item.eventDate||item.event_date,eventTime:item.eventTime||item.event_time,acknowledgedAt:now,acknowledgedBy:"Current session"};
      });
      localStorage.setItem(ACK_STORAGE_KEY,JSON.stringify(next));
      return next;
    });
    try{
      const resp=await reservationAPI.acknowledgeNotifications(payloadItems);
      const shared=normalizeAcknowledgments(resp?.data||[]);
      if(Object.keys(shared).length){
        setAcknowledgments(prev=>{
          const next={...prev,...shared};
          localStorage.setItem(ACK_STORAGE_KEY,JSON.stringify(next));
          return next;
        });
      }
    }catch{}
    setPopupQueue(q=>q.slice(1));
    stopAlert();
    addToast("Notification acknowledged.","success");
  },[addToast]);
  useEffect(()=>{const t=setInterval(()=>{setClock(clockStr());setDate(dateStr());},1000);return()=>clearInterval(t);},[]);

  const checkAlerts=useCallback((list)=>{
    const cands=list.filter(isApproved).map(res=>{
      const id=res.id??res.db_id,key=`${id}-alert`;
      if(acknowledgments[String(id)])return null;
      if(firedAlerts.current.has(key))return null;
      const dt=parseEventDate(res.event_date||res.eventDate||res.reservationDate,res.event_time||res.eventTime||res.reservationTime);
      if(!dt)return null;
      const diff=dt.getTime()-Date.now();
      if(diff>0&&diff<=2*3_600_000)return{res,id,key,diff};return null;
    }).filter(Boolean).sort((a,b)=>a.diff-b.diff);
    if(!cands.length)return;
    cands.forEach(({key})=>firedAlerts.current.add(key));
    const items=cands.map(({res})=>({id:res.id??res.db_id,db_id:res.db_id,name:res.guest_name||res.name||"Guest",room:res.room||res.venue||"",eventDate:res.event_date||res.eventDate||res.reservationDate,eventTime:res.event_time||res.eventTime||res.reservationTime}));
    setPopupQueue(q=>[...q,{items,primaryId:items[0].id}]);
    const first=cands[0].res,rel=relLabel(cands[0].diff);
    if(cands.length===1)playAlertThenSpeak(`Reminder. ${first.guest_name||first.name||"A guest"}'s reservation starts in ${rel}.`);
    else playAlertThenSpeak(`Reminder. ${cands.length} reservations coming up. Earliest in ${rel}.`);
  },[acknowledgments]);

  const upsertReservation=useCallback((res,isInit=false)=>{
    const id=res.id??res.db_id;if(!id)return;
    if(!shouldTrack(res)){setAllCards(p=>p.filter(r=>(r.id??r.db_id)!==id));knownIds.current.delete(id);return;}
    const isNew=!knownIds.current.has(id);knownIds.current.add(id);
    setAllCards(p=>{ if(!isNew)return p.map(r=>(r.id??r.db_id)===id?{...r,...res}:r); return[res,...p].sort((a,b)=>(b.submittedTimestamp||+new Date(b.created_at)||0)-(a.submittedTimestamp||+new Date(a.created_at)||0)); });
    setDetailRes(p=>p&&(p.id??p.db_id)===id?{...p,...res}:p);
    if(!isInit&&isNew){
      setNewIds(p=>new Set([...p,id]));setTimeout(()=>setNewIds(p=>{const n=new Set(p);n.delete(id);return n;}),4000);
      if(leftRef.current)leftRef.current.scrollTo({top:0,behavior:"smooth"});
      if(isPending(res)){playPendingChime();setLeftTab("pending");}
      else if(isApproved(res)){playApproveSound();checkAlerts([res]);}
    }
    if(!isInit&&!isNew&&isApproved(res))checkAlerts([res]);
  },[checkAlerts]);

  const handleApproveRequest=useCallback(res=>setConfirmRes(res),[]);
  const handleDeclineRequest=useCallback(res=>setDeclineRes(res),[]);

  // FIX: handleApproveConfirm now calls optimisticSeatUpdate so the seatmap
  // turns red immediately when approving from NotificationDashboard, same as
  // when approving from ReservationDashboard.
  const handleApproveConfirm=useCallback(async()=>{
    if(!confirmRes)return;
    const id=confirmRes.id??confirmRes.db_id,dbId=confirmRes.db_id??Number(confirmRes.id);
    setIsApproving(true);setApprovingIds(p=>new Set([...p,id]));
    try{
      const result = await reservationAPI.approve(dbId);
      // Update local card state
      upsertReservation({
        ...confirmRes,
        status:"reserved",
        reservation_state:"active",
        previous_status:result?.previous_status||confirmRes.status,
        status_last_changed_at:result?.status_last_changed_at||new Date().toISOString(),
        transaction_history:result?.transaction_history||confirmRes.transaction_history
      },false);
      // FIX: Update seatmap in localStorage and broadcast to client pages
      optimisticSeatUpdate(confirmRes, "reserved");
      playApproveSound();
      addToast(`✓ ${confirmRes.guest_name||confirmRes.name||"Reservation"} approved!`,"success");
      setConfirmRes(null);
      setLeftTab("upcoming");
    }
    catch{addToast("Failed to approve. Please try again.","error");}
    finally{setIsApproving(false);setApprovingIds(p=>{const n=new Set(p);n.delete(id);return n;});}
  },[confirmRes,upsertReservation,addToast]);

  const handleDeclineConfirm=useCallback(async(reason)=>{
    if(!declineRes)return;
    const id=declineRes.id??declineRes.db_id,dbId=declineRes.db_id??Number(declineRes.id);
    setIsDeclining(true);setDecliningIds(p=>new Set([...p,id]));
    try{
      const result = await reservationAPI.reject(dbId,reason);
      upsertReservation({
        ...declineRes,
        status:"rejected",
        reservation_state:"inactive",
        previous_status:result?.previous_status||declineRes.status,
        status_last_changed_at:result?.status_last_changed_at||new Date().toISOString(),
        rejected_at:result?.rejected_at||new Date().toISOString(),
        rejection_reason:reason,
        transaction_history:result?.transaction_history||declineRes.transaction_history
      },false);
      optimisticSeatUpdate(declineRes, "available");
      addToast(`${declineRes.guest_name||declineRes.name||"Reservation"} declined.`,"success");
      setDeclineRes(null);
      setRightTab("declined");
    }
    catch{addToast("Failed to decline. Please try again.","error");}
    finally{setIsDeclining(false);setDecliningIds(p=>{const n=new Set(p);n.delete(id);return n;});}
  },[declineRes,upsertReservation,addToast]);

  const syncReservations=useCallback(async({silent=true}={})=>{
    if(!silent)setLoading(true);
    try{
      const resp=await reservationAPI.getAll("?per_page=200");
      const raw=Array.isArray(resp)?resp:Array.isArray(resp?.data)?resp.data:[];
      const tracked=raw
        .filter(shouldTrack)
        .map(normaliseRow)
        .sort((a,b)=>(b.submittedTimestamp||+new Date(b.created_at)||0)-(a.submittedTimestamp||+new Date(a.created_at)||0));

      knownIds.current=new Set(tracked.map(r=>r.id??r.db_id));
      setAllCards(tracked);
      checkAlerts(tracked);
    }catch{}
    finally{if(!silent)setLoading(false);}
  },[checkAlerts]);

  useEffect(()=>{syncReservations({silent:false});},[syncReservations]);

  useEffect(() => {
    const handleNotificationsChanged = () => {
      syncReservations({ silent: true });
    };
    window.addEventListener("bellevue:notifications-changed", handleNotificationsChanged);
    return () => window.removeEventListener("bellevue:notifications-changed", handleNotificationsChanged);
  }, [syncReservations]);

  useEffect(()=>{
    const wsHost=import.meta.env.VITE_WS_HOST||"localhost",wsPort=import.meta.env.VITE_WS_PORT||"6001";
    const protocol=window.location.protocol==="https:"?"wss:":"ws:";
    const wsUrl=`${protocol}//${wsHost}:${wsPort}`;

    const clearReconnect=()=>{
      if(reconnectTimer.current){clearTimeout(reconnectTimer.current);reconnectTimer.current=null;}
    };

    const clearPoll=()=>{
      if(pollTimer.current){clearInterval(pollTimer.current);pollTimer.current=null;}
      if(recoveryTimer.current){clearInterval(recoveryTimer.current);recoveryTimer.current=null;}
    };

    const shouldFallbackToPolling=()=>{
      const now=Date.now();
      reconnectAttempts.current=[...reconnectAttempts.current.filter(ts=>now-ts<=RECONNECT_WINDOW_MS),now];
      return reconnectAttempts.current.length>=MAX_RECONNECTS_IN_WINDOW;
    };

    const connect=()=>{
      if(!isMounted.current)return;
      clearReconnect();
      if(!echoRef.current){setWsStatus(prev=>prev==="polling"?prev:"connecting");}

      const ws=new WebSocket(wsUrl);
      echoRef.current=ws;

      ws.onopen=()=>{
        setWsStatus("connected");
        reconnectDelay.current=2000;
        reconnectAttempts.current=[];
        clearPoll();
      };

      ws.onclose=()=>{
        echoRef.current=null;
        if(!isMounted.current)return;
        if(shouldFallbackToPolling()){
          setWsStatus("polling");
          if(!pollTimer.current){
            syncReservations({silent:true});
            pollTimer.current=setInterval(()=>syncReservations({silent:true}),POLL_INTERVAL_MS);
          }
          if(!recoveryTimer.current){
            recoveryTimer.current=setInterval(()=>{
              if(!echoRef.current&&isMounted.current)connect();
            },WS_RECOVERY_RETRY_MS);
          }
          return;
        }
        setWsStatus("disconnected");
        const delay=reconnectDelay.current;
        reconnectTimer.current=setTimeout(()=>connect(),delay);
        reconnectDelay.current=Math.min(reconnectDelay.current*2,30000);
      };

      ws.onerror=()=>{
        if(!isMounted.current)return;
        setWsStatus(prev=>prev==="polling"?"polling":"error");
        if(ws.readyState===WebSocket.OPEN)ws.close();
      };

      ws.onmessage=event=>{
        try{
          const data=JSON.parse(event.data);
          const eventName=data?.event;
          if(eventName==="connected")return;
          if(eventName==="ReservationCreated"||eventName==="ReservationUpdated"||eventName==="updated"){
            const payload=data?.payload?.reservation??data?.payload;
            if(payload&&typeof payload==="object")upsertReservation(normaliseRow(payload),false);
            return;
          }
          if(eventName==="NotificationAcknowledged"){
            const payload=data?.payload?.acknowledgments||data?.payload?.data||[];
            const shared=normalizeAcknowledgments(payload);
            if(Object.keys(shared).length){
              setAcknowledgments(prev=>{
                const next={...prev,...shared};
                localStorage.setItem(ACK_STORAGE_KEY,JSON.stringify(next));
                return next;
              });
            }
            return;
          }
          if(eventName==="ReservationDeleted"){
            const deletedId=data?.payload?.id??data?.payload?.reservation?.id;
            if(deletedId===undefined||deletedId===null)return;
            const strId=String(deletedId);
            setAllCards(p=>p.filter(r=>String(r.db_id)!==strId&&String(r.id)!==strId));
            knownIds.current.delete(deletedId);
            knownIds.current.delete(strId);
          }
        }catch(err){console.error('[Notifications WS] Parse error:', err);}
      };
    };

    connect();

    return()=>{
      clearReconnect();
      clearPoll();
      if(echoRef.current){const socket=echoRef.current;echoRef.current=null;socket.close();}
    };
  },[syncReservations,upsertReservation]);

  const scopedOutletRooms=useMemo(()=>getScopedOutletRooms(currentUser),[currentUser]);
  const outletSummaries=useMemo(()=>outletCountsFor(allCards),[allCards]);
  const completeOutletSummaries=useMemo(()=>{
    const allowedSet=new Set(scopedOutletRooms.map(canonicalOutletName));
    const masterSet=new Set(ADMIN_OUTLET_ROOMS.map(canonicalOutletName));
    const byName=new Map(outletSummaries.map(item=>[canonicalOutletName(item.outlet),item]));
    const catalogRows=scopedOutletRooms.map(outlet=>byName.get(canonicalOutletName(outlet))||{outlet,total:0,pending:0,upcoming:0,accepted:0,declined:0});
    const extras=outletSummaries.filter(item=>allowedSet.has(canonicalOutletName(item.outlet))&&!masterSet.has(canonicalOutletName(item.outlet)));
    return [...catalogRows,...extras];
  },[outletSummaries,scopedOutletRooms]);
  const outletOptions=useMemo(()=>["ALL",...completeOutletSummaries.map(item=>item.outlet)],[completeOutletSummaries]);

  useEffect(()=>{
    if(outletFilter==="ALL")return;
    if(!outletOptions.includes(outletFilter)){
      setOutletFilter("ALL");
    }
  },[outletFilter,outletOptions]);

  const filteredCards=useMemo(
    ()=>allCards.filter(res=>outletFilter==="ALL"||getOutletName(res)===outletFilter),
    [allCards,outletFilter]
  );

  const{upcomingCards,pendingCards,acceptedCards,declinedCards}=useMemo(()=>{
    const u=[],p=[],a=[],x=[];
    filteredCards.forEach(res=>{
      if(isPending(res)){p.push(res);return;}
      if(isDeclined(res)){x.push(res);return;}
      if(!isApproved(res))return;
      a.push(res);
      const dt=parseEventDate(res.event_date||res.eventDate||res.reservationDate,res.event_time||res.eventTime||res.reservationTime);
      if(!dt||dt.getTime()>Date.now())u.push(res);
    });
    return{upcomingCards:u,pendingCards:p,acceptedCards:a,declinedCards:x};
  },[filteredCards]);

  const leftCards=leftTab==="upcoming"?upcomingCards:pendingCards;
  const rightCards=rightTab==="declined"?declinedCards:acceptedCards;
  const leftVisible=leftCards.slice((pendingPage-1)*pendingPerPage,pendingPage*pendingPerPage);
  const doneVisible=rightCards.slice((donePage-1)*donePerPage,donePage*donePerPage);
  const {activeAlerts,acknowledgedAlerts}=useMemo(()=>{
    const now=Date.now();
    const active=filteredCards
      .filter(isApproved)
      .map(res=>{
        const id=notificationId(res);
        const dt=parseEventDate(res.event_date||res.eventDate||res.reservationDate,res.event_time||res.eventTime||res.reservationTime);
        if(!id||!dt||acknowledgments[id])return null;
        const diff=dt.getTime()-now;
        if(diff<=0||diff>2*3_600_000)return null;
        return {id,db_id:res.db_id,name:res.guest_name||res.name||"Guest",room:getOutletName(res),eventDate:res.event_date||res.eventDate||res.reservationDate,eventTime:res.event_time||res.eventTime||res.reservationTime};
      })
      .filter(Boolean);
    return {activeAlerts:active,acknowledgedAlerts:Object.values(acknowledgments)};
  },[filteredCards,acknowledgments]);

  const handlePopupView=useCallback(p=>{dismissPopup();const items=p.items||[];if(items.length===1){const full=allCards.find(r=>(r.id??r.db_id)===items[0].id);if(full)setDetailRes(full);}else setPickerItems(items);},[allCards,dismissPopup]);

  const renderNotificationCard = (item) => {
    const isNew = newIds.has(item.id);
    const read = item.read;
    const details = item.details;
    const res = item.res;
    const id = item.id;
    const db_id = item.db_id;
    const outlet = item.outlet;
    const isApprovingThis = approvingIds.has(id);
    const isDecliningThis = decliningIds.has(id);

    return (
      <div
        key={id}
        onClick={() => handleCardClick(item)}
        className="notif-card"
        style={{
          background: isNew ? C.goldFaintest : C.cardBg,
          border: `1px solid ${isNew ? C.borderAccent : C.cardBorder}`,
          borderRadius: 10,
          padding: "14px 16px",
          position: "relative",
          boxShadow: isNew ? `0 0 0 3px ${C.goldFaint}` : "none",
          opacity: read ? 0.78 : 1,
        }}
      >
        {/* Unread indicator dot */}
        {!read && (
          <div style={{
            position: "absolute",
            top: 18,
            left: 6,
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: C.red,
          }} />
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{
              fontFamily: F.label,
              fontSize: 10,
              fontWeight: 800,
              color: details.color,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}>
              {details.label}
            </span>
            <span style={{ color: C.textTertiary, fontSize: 11 }}>
              {timeAgo(res.created_at || res.submitted_timestamp)}
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, alignItems: "center" }} onClick={e => e.stopPropagation()}>
            {item.needsAck && (
              <button
                onClick={(e) => handleAcknowledge(res, e)}
                style={{
                  padding: "4px 8px",
                  background: C.gold,
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 10,
                  fontWeight: 700,
                  fontFamily: F.label,
                  textTransform: "uppercase",
                  cursor: "pointer",
                }}
              >
                Acknowledge
              </button>
            )}
            {!read && (
              <button
                onClick={(e) => markAsRead(db_id, e)}
                title="Mark as Read"
                style={{
                  background: "transparent",
                  border: `1px solid ${C.borderDefault}`,
                  color: C.textSecondary,
                  borderRadius: 6,
                  padding: "3px 6px",
                  fontSize: 10,
                  fontWeight: 500,
                  fontFamily: F.label,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <Check size={11} />
                Mark Read
              </button>
            )}
            <StatusBadge status={res.status} C={C} />
          </div>
        </div>

        {/* Description */}
        <div style={{
          fontFamily: F.body,
          fontSize: 13.5,
          fontWeight: read ? 500 : 700,
          color: C.textPrimary,
          lineHeight: 1.4,
          marginBottom: 8,
        }}>
          {details.description}
        </div>

        {/* Metadata Details Row */}
        <div style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px 16px",
          fontFamily: F.body,
          fontSize: 11.5,
          color: C.textSecondary,
        }}>
          <span>Reference: <strong style={{ color: C.gold, fontFamily: F.mono }}>{item.referenceCode}</strong></span>
          <span>Venue/Outlet: <strong>{outlet}</strong></span>
          <span>Guest Count: <strong>{res.guests_count || res.guests || 1} pax</strong></span>
          <span>Schedule: <strong>{fmtDate(item.eventDate)} at {fmtTime(item.eventTime)}</strong></span>
        </div>

        {/* Action Button for Pending reservations */}
        {res.status === "pending" && canManageReservations && (
          <div
            style={{
              marginTop: 12,
              paddingTop: 10,
              borderTop: `1px solid ${C.divider}`,
              display: "flex",
              justifyContent: "flex-end",
              gap: 8,
            }}
            onClick={e => e.stopPropagation()}
          >
            <button
              onClick={() => handleDeclineRequest(res)}
              disabled={isApprovingThis || isDecliningThis}
              style={{
                padding: "6px 12px",
                background: "transparent",
                border: `1px solid ${C.redBorder}`,
                borderRadius: 8,
                fontFamily: F.label,
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: C.red,
                cursor: "pointer",
              }}
            >
              Decline
            </button>
            <button
              onClick={() => handleApproveRequest(res)}
              disabled={isApprovingThis || isDecliningThis}
              style={{
                padding: "6px 12px",
                background: C.green,
                border: "none",
                borderRadius: 8,
                fontFamily: F.label,
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "#fff",
                cursor: "pointer",
              }}
            >
              Approve
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: C.pageBg, fontFamily: F.body }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes modalIn{from{opacity:0;transform:translateY(12px) scale(0.97);}to{opacity:1;transform:none;}}
        @keyframes cardSlideIn{from{opacity:0;transform:translateY(-8px) scale(0.98);}to{opacity:1;transform:none;}}
        @keyframes bellRing{0%,100%{transform:rotate(0deg);}25%{transform:rotate(-16deg);}75%{transform:rotate(16deg);}}
        @keyframes dotPulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.3;transform:scale(1.8);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
        .notif-card { transition: all 0.2s ease; cursor: pointer; }
        .notif-card:hover { border-color: ${C.borderAccent} !important; background: ${C.goldFaintest} !important; }
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.10);border-radius:4px;}
        @media (max-width: 768px) {
          .nd-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>

      <Sidebar activeNav="" isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", flex: 1, minWidth: 0, overflow: "hidden" }}>
        <AdminNavbar />
        
        <main style={{ flex: 1, padding: "30px 32px 42px", overflow: "auto", position: "relative" }}>
          <div style={{ maxWidth: 1440, display: "grid", gap: 18, animation: "fadeUp 0.32s ease" }}>
            
            {/* Page Header */}
            <AdminPageHeader
              eyebrow="Monitoring"
              title="Notification Center"
              description="Monitor all venue requests, updates, cancellations, and coordinate operational acknowledgments in real-time."
              C={C}
              F={F}
              actions={
                notificationCounts.unread > 0 && (
                  <button
                    onClick={markAllAsRead}
                    style={{
                      height: 38,
                      padding: "0 14px",
                      border: `1px solid ${C.borderAccent}`,
                      borderRadius: 9,
                      background: C.gold,
                      color: "#fff",
                      fontFamily: F.label,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Check size={13} />
                    Mark all as read
                  </button>
                )
              }
            />

            {/* Counts Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
              {[
                { label: "Pending Requests", value: notificationCounts.pending, desc: "Awaiting administrator review", border: C.gold },
                { label: "Unread Notifications", value: notificationCounts.unread, desc: "New updates needing attention", border: C.red, highlight: notificationCounts.unread > 0 },
                { label: "Acknowledged Alerts", value: notificationCounts.acknowledged, desc: "Recent operational logs", border: C.green },
                { label: "Total Alerts", value: notificationCounts.total, desc: "Scope-authorized entries", border: C.blue },
              ].map((card, i) => (
                <div
                  key={i}
                  style={{
                    background: `linear-gradient(180deg, ${C.surface} 0%, ${C.surfaceSoft} 100%)`,
                    border: `1px solid ${card.highlight ? C.redBorder : C.borderDefault}`,
                    borderRadius: 12,
                    padding: "16px 18px",
                    boxShadow: C.shadowSoft,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    minHeight: 120,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                    <div>
                      <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold, marginBottom: 4 }}>
                        {card.label}
                      </div>
                      <div style={{ fontSize: 11.5, color: C.textSecondary }}>{card.desc}</div>
                    </div>
                    <div style={{
                      minWidth: 40,
                      height: 36,
                      borderRadius: 8,
                      background: card.highlight ? C.redFaint : C.goldFaint,
                      color: card.highlight ? C.red : C.gold,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 18,
                      fontWeight: 800,
                    }}>
                      {card.value}
                    </div>
                  </div>
                  <div style={{ height: 2, background: `linear-gradient(90deg, ${card.border}80, transparent)`, marginTop: 12, borderRadius: 1 }} />
                </div>
              ))}
            </div>

            {/* Main Content Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "minmax(0,3fr) minmax(0,1.4fr)", gap: 14 }} className="nd-grid">
              
              {/* Left Side: Filter Toolbar & Notifications List */}
              <div style={{ display: "grid", gap: 14 }}>
                
                {/* Filter Toolbar Panel */}
                <Panel C={C} accentColor={C.gold}>
                  <div style={{ padding: "14px 16px", display: "grid", gap: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.divider}`, paddingBottom: 8 }}>
                      <span style={{ fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: C.gold }}>
                        Filter Toolbar
                      </span>
                      {outletFilter !== "ALL" && (
                        <span style={{ fontSize: 11.5, color: C.textSecondary, fontFamily: F.body }}>
                          Outlet: <strong>{outletFilter}</strong>
                        </span>
                      )}
                    </div>
                    
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                      
                      {/* Search */}
                      <div style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>Search</span>
                        <div style={{ position: "relative" }}>
                          <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: C.textTertiary, pointerEvents: "none" }} />
                          <input
                            value={filterSearch}
                            onChange={(e) => { setFilterSearch(e.target.value); setPage(1); }}
                            placeholder="Guest name, reference..."
                            style={{
                              width: "100%",
                              height: 36,
                              padding: "0 10px 0 32px",
                              border: `1px solid ${C.borderDefault}`,
                              borderRadius: 8,
                              background: C.surfaceInput,
                              color: C.textPrimary,
                              fontFamily: F.body,
                              fontSize: 12,
                              outline: "none",
                            }}
                          />
                        </div>
                      </div>

                      {/* Outlet Filter Select */}
                      <div style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>Outlet / Venue</span>
                        <select
                          value={outletFilter}
                          onChange={(e) => { setOutletFilter(e.target.value); setPage(1); }}
                          style={{
                            width: "100%",
                            height: 36,
                            padding: "0 10px",
                            border: `1px solid ${C.borderDefault}`,
                            borderRadius: 8,
                            background: C.surfaceBase,
                            color: C.textPrimary,
                            fontFamily: F.body,
                            fontSize: 12,
                            outline: "none",
                          }}
                        >
                          <option value="ALL">All Outlets</option>
                          {completeOutletSummaries.map(o => (
                            <option key={o.outlet} value={o.outlet}>{o.outlet} ({o.total})</option>
                          ))}
                        </select>
                      </div>

                      {/* Notification Type Filter Select */}
                      <div style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>Notification Type</span>
                        <select
                          value={filterType}
                          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
                          style={{
                            width: "100%",
                            height: 36,
                            padding: "0 10px",
                            border: `1px solid ${C.borderDefault}`,
                            borderRadius: 8,
                            background: C.surfaceBase,
                            color: C.textPrimary,
                            fontFamily: F.body,
                            fontSize: 12,
                            outline: "none",
                          }}
                        >
                          <option value="ALL">All Types</option>
                          <option value="new_request">New Requests</option>
                          <option value="room_assignment_needed">Room Assignment Needed</option>
                          <option value="cancelled">Cancellations</option>
                          <option value="updated">Guest Updates</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Declined</option>
                        </select>
                      </div>

                      {/* Date Range Start */}
                      <div style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>Start Date</span>
                        <input
                          type="date"
                          value={filterDateStart}
                          onChange={(e) => { setFilterDateStart(e.target.value); setPage(1); }}
                          style={{
                            width: "100%",
                            height: 36,
                            padding: "0 10px",
                            border: `1px solid ${C.borderDefault}`,
                            borderRadius: 8,
                            background: C.surfaceBase,
                            color: C.textPrimary,
                            fontFamily: F.body,
                            fontSize: 12,
                            outline: "none",
                          }}
                        />
                      </div>

                      {/* Date Range End */}
                      <div style={{ display: "grid", gap: 4 }}>
                        <span style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>End Date</span>
                        <input
                          type="date"
                          value={filterDateEnd}
                          onChange={(e) => { setFilterDateEnd(e.target.value); setPage(1); }}
                          style={{
                            width: "100%",
                            height: 36,
                            padding: "0 10px",
                            border: `1px solid ${C.borderDefault}`,
                            borderRadius: 8,
                            background: C.surfaceBase,
                            color: C.textPrimary,
                            fontFamily: F.body,
                            fontSize: 12,
                            outline: "none",
                          }}
                        />
                      </div>

                    </div>
                  </div>
                </Panel>

                {/* Notifications List Panel */}
                <Panel C={C} accentColor={C.gold}>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", color: C.gold }}>
                      Notification List ({filteredNotifications.length})
                    </span>
                    <span style={{ fontSize: 11, color: C.textSecondary, fontFamily: F.label }}>
                      Showing {Math.min(filteredNotifications.length, page * perPage)} of {filteredNotifications.length}
                    </span>
                  </div>

                  <div style={{ padding: "14px 16px", display: "grid", gap: 16 }}>
                    {loading ? (
                      <div style={{ padding: "48px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                        <Spinner C={C} size={20} />
                        <span style={{ fontSize: 12, color: C.textSecondary, fontFamily: F.label, letterSpacing: "0.05em", textTransform: "uppercase" }}>Loading Alerts...</span>
                      </div>
                    ) : filteredNotifications.length === 0 ? (
                      <div style={{ padding: "72px 0", textAlign: "center", color: C.textTertiary, fontSize: 13, display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                        <Inbox size={32} style={{ strokeWidth: 1.5, opacity: 0.5 }} />
                        No notifications match the active filters.
                      </div>
                    ) : (
                      <>
                        {/* Render Group: Today */}
                        {paginatedGroupedNotifications.today.length > 0 && (
                          <div>
                            <SectionLabel C={C}>Today</SectionLabel>
                            <div style={{ display: "grid", gap: 8 }}>
                              {paginatedGroupedNotifications.today.map(item => renderNotificationCard(item))}
                            </div>
                          </div>
                        )}

                        {/* Render Group: Yesterday */}
                        {paginatedGroupedNotifications.yesterday.length > 0 && (
                          <div style={{ marginTop: 14 }}>
                            <SectionLabel C={C}>Yesterday</SectionLabel>
                            <div style={{ display: "grid", gap: 8 }}>
                              {paginatedGroupedNotifications.yesterday.map(item => renderNotificationCard(item))}
                            </div>
                          </div>
                        )}

                        {/* Render Group: Older */}
                        {paginatedGroupedNotifications.older.length > 0 && (
                          <div style={{ marginTop: 14 }}>
                            <SectionLabel C={C}>Older</SectionLabel>
                            <div style={{ display: "grid", gap: 8 }}>
                              {paginatedGroupedNotifications.older.map(item => renderNotificationCard(item))}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <Pagination page={page} total={filteredNotifications.length} perPage={perPage} setPage={setPage} setPerPage={setPerPage} C={C} />
                </Panel>

              </div>

              {/* Right Side: Acknowledgment Monitor & History */}
              <div style={{ display: "grid", gap: 14, alignContent: "start" }}>
                
                {/* Active Alerts Acknowledgment Monitor */}
                <AcknowledgmentMonitor
                  activeAlerts={activeAlerts}
                  acknowledgedAlerts={acknowledgedAlerts}
                  onAcknowledge={acknowledgeAlerts}
                  canAcknowledge={canAcknowledgeNotifications}
                  C={C}
                />

                {/* Acknowledgment History Panel */}
                <Panel C={C} accentColor={C.green}>
                  <div style={{ padding: "12px 16px", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle size={13} color={C.green} />
                    <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: C.green }}>
                      Acknowledgment History
                    </span>
                  </div>
                  
                  <div style={{ padding: "12px", display: "grid", gap: 10, maxHeight: 400, overflowY: "auto" }}>
                    {acknowledgedAlerts.length === 0 ? (
                      <div style={{ padding: "24px 0", textAlign: "center", color: C.textTertiary, fontSize: 11.5 }}>
                        No acknowledgment records found.
                      </div>
                    ) : (
                      [...acknowledgedAlerts].reverse().slice(0, 30).map((ack, i) => (
                        <div
                          key={i}
                          style={{
                            border: `1px solid ${C.greenBorder}`,
                            borderRadius: 8,
                            padding: "10px 12px",
                            background: C.greenFaint,
                            fontSize: 12,
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                            <strong style={{ color: C.textPrimary, fontWeight: 650 }}>{ack.name}</strong>
                            <span style={{ color: C.textTertiary, fontSize: 10 }}>
                              {new Date(ack.acknowledgedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div style={{ color: C.textSecondary, fontSize: 11, marginBottom: 6 }}>
                            {ack.room} · {fmtDate(ack.eventDate)} {fmtTime(ack.eventTime)}
                          </div>
                          <div style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            fontSize: 10,
                            color: C.green,
                            fontFamily: F.label,
                            textTransform: "uppercase",
                            letterSpacing: "0.03em",
                            borderTop: `1px dashed ${C.greenBorder}`,
                            paddingTop: 6,
                            marginTop: 4,
                          }}>
                            <span>By: <strong>{ack.acknowledgedBy}</strong></span>
                            <span>{ack.acknowledgedByRole || "Staff"}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </Panel>

              </div>

            </div>

          </div>
        </main>
      </div>

      {popup&&<ReminderPopup popup={popup} queueCount={popupQueue.length} onView={handlePopupView} onClose={dismissPopup} onAcknowledge={acknowledgeAlerts} canAcknowledge={canAcknowledgeNotifications} C={C}/>}
      {pickerItems&&<EventPickerModal items={pickerItems} allCards={allCards} onSelect={r=>{setPickerItems(null);setDetailRes(r);}} onClose={()=>setPickerItems(null)} C={C}/>}
      {detailRes&&<DetailModal res={detailRes} onClose={()=>setDetailRes(null)} onApprove={handleApproveRequest} onDecline={handleDeclineRequest} approvingIds={approvingIds} decliningIds={decliningIds} canManage={canManageReservations} C={C}/>}
      {confirmRes&&<ApproveConfirmModal res={confirmRes} onConfirm={handleApproveConfirm} onCancel={()=>{if(!isApproving)setConfirmRes(null);}} isApproving={isApproving} C={C}/>}
      {declineRes&&<DeclineConfirmModal res={declineRes} onConfirm={handleDeclineConfirm} onCancel={()=>{if(!isDeclining)setDeclineRes(null);}} isDeclining={isDeclining} C={C}/>}
      <Toast toasts={toasts} C={C}/>
    </div>
  );
}

export default NotificationDashboard;

