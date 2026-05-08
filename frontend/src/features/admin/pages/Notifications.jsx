// src/features/admin/pages/NotificationDashboard.jsx
import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Bell, BellDot, Clock, X, CalendarDays,
  MapPin, Users, Phone, Mail, FileText, Hash, CheckCircle,
  Wifi, WifiOff, ThumbsUp, ChevronLeft, ChevronRight,
  XCircle,
} from "lucide-react";
import { reservationAPI } from "../../../services/reservationAPI";
import { authAPI } from "../../../services/authAPI";
import bellevueLogo from "../../../assets/bellevue-logo.png";

function getTokens() {
  return {
    gold: "#8C6B2A",
    goldLight: "#A07D38",
    goldFaint: "rgba(140,107,42,0.07)",
    goldFaintest: "rgba(140,107,42,0.04)",
    pageBg: "#F7F4EE",
    surfaceBase: "#FFFFFF",
    surfaceRaised: "#FFFFFF",
    surfaceInput: "rgba(0,0,0,0.03)",
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
    blue: "#5B8FD4",
    blueFaint: "rgba(91,143,212,0.08)",
    blueBorder: "rgba(91,143,212,0.20)",
    badgePending:  { bg: "rgba(140,107,42,0.09)",  color: "#8C6B2A",  dot: "#8C6B2A"  },
    badgeApproved: { bg: "rgba(46,122,90,0.09)",   color: "#2E7A5A",  dot: "#2E7A5A"  },
    badgeRejected: { bg: "rgba(160,56,56,0.09)",   color: "#A03838",  dot: "#A03838"  },
    navBg: "rgba(247,244,238,0.97)",
    navBorder: "rgba(140,107,42,0.14)",
    divider: "rgba(0,0,0,0.05)",
    inputFocusShadow: "0 0 0 3px rgba(140,107,42,0.10)",
    modalOverlay: "rgba(0,0,0,0.42)",
    statusNote: { pending: "rgba(140,107,42,0.05)", approved: "rgba(46,122,90,0.05)" },
    statusNoteBorder: { pending: "rgba(140,107,42,0.15)", approved: "rgba(46,122,90,0.15)" },
    // FIX: headerGradient uses a light background — modal titles need dark text
    headerGradient: "linear-gradient(160deg,#FAF8F4 0%,#F2EFE8 100%)",
    spinnerBorder: "rgba(0,0,0,0.12)",
    spinnerTop: "#8C6B2A",
    cardBg: "#FFFFFF",
    cardBorder: "rgba(0,0,0,0.07)",
    bgFilter: "blur(6px) brightness(0.45) saturate(0.4)",
    bgOverlay: "rgba(237,233,224,0.65)",
  };
}

const F = {
  display: "'Inter','Helvetica Neue',Arial,sans-serif",
  body:    "'Inter','Helvetica Neue',Arial,sans-serif",
  mono:    "'Inter','Helvetica Neue',Arial,sans-serif",
  label:   "'Inter','Helvetica Neue',Arial,sans-serif",
};

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
  return String(res.room || res.venue?.name || res.venue || "Unassigned Outlet").trim();
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

function loadAcknowledgments() {
  try {
    return JSON.parse(localStorage.getItem(ACK_STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
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
    ["Seat", res.seat_number??res.seat?`Seat ${res.seat_number||res.seat}`:"-"],
    ["Guests", (res.guests_count||res.guests||1)>0?`${res.guests_count||res.guests||1} guest${(res.guests_count||res.guests||1)!==1?"s":""}`:"-"],
    ["Event Date", fmtDate(res.event_date||res.eventDate||res.reservationDate)],
    ["Event Time", fmtTime(res.event_time||res.eventTime||res.reservationTime)],
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
  return (
    <div style={{ background:hi?C.goldFaintest:C.cardBg,border:`1px solid ${hi?C.borderAccent:C.cardBorder}`,borderRadius:10,padding:"15px 16px",marginBottom:8,boxShadow:hi?`0 0 0 3px ${C.goldFaint}`:"none",transition:"all 0.30s ease",animation:isNew?"cardSlideIn 0.40s cubic-bezier(0.34,1.5,0.64,1)":"none",cursor:"pointer" }} onClick={()=>onClick(res)} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.borderAccent;e.currentTarget.style.background=C.goldFaintest;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=hi?C.borderAccent:C.cardBorder;e.currentTarget.style.background=hi?C.goldFaintest:C.cardBg;}}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,gap:10 }}>
        <div style={{ fontFamily:F.body,fontSize:13.5,fontWeight:600,color:C.textPrimary,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{res.guest_name||res.name||"Unknown Guest"}</div>
        <StatusBadge status={rawStatus} C={C}/>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"5px 8px" }}>
        {[
          {icon:<MapPin size={10}/>,      val:res.room||res.venue},
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
  return (
    <div onClick={()=>onClick(res)} style={{ background:C.cardBg,border:`1px solid ${C.greenBorder}`,borderRadius:10,padding:"13px 15px",marginBottom:8,cursor:"pointer",transition:"all 0.18s" }} onMouseEnter={e=>{e.currentTarget.style.borderColor=C.green;e.currentTarget.style.background=C.greenFaint;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=C.greenBorder;e.currentTarget.style.background=C.cardBg;}}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:7,gap:8 }}>
        <div style={{ fontFamily:F.body,fontSize:13,fontWeight:600,color:C.textPrimary,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{res.guest_name||res.name||"Unknown Guest"}</div>
        <StatusBadge status={res.status} C={C}/>
      </div>
      <div style={{ display:"flex",gap:12,flexWrap:"wrap" }}>
        {[fmtDate(res.event_date||res.eventDate||res.reservationDate),fmtTime(res.event_time||res.eventTime||res.reservationTime),res.room||res.venue].filter(Boolean).map((v,i)=>(
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
  const C=getTokens();
  const canManageReservations = authAPI.hasPermission("manage_reservations");
  const canAcknowledgeNotifications = authAPI.hasPermission("acknowledge_notifications");

  const [allCards,setAllCards]=useState([]);
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

  useEffect(()=>{isMounted.current=true;return()=>{isMounted.current=false;};},[]);
  const addToast=useCallback((message,type="success")=>{const id=Date.now();setToasts(p=>[...p,{id,message,type}]);setTimeout(()=>setToasts(p=>p.filter(t=>t.id!==id)),3500);},[]);
  const dismissPopup=useCallback(()=>{setPopupQueue(q=>{const next=q.slice(1);if(!next.length)stopAlert();return next;});},[]);
  const acknowledgeAlerts=useCallback((alerts)=>{
    const items=Array.isArray(alerts)?alerts:(alerts?.items||[]);
    if(!items.length)return;
    const now=new Date().toISOString();
    setAcknowledgments(prev=>{
      const next={...prev};
      items.forEach(item=>{
        const id=notificationId(item);
        if(id)next[id]={id,name:item.name||item.guest_name||"Reservation",room:item.room||"",eventDate:item.eventDate||item.event_date,eventTime:item.eventTime||item.event_time,acknowledgedAt:now};
      });
      localStorage.setItem(ACK_STORAGE_KEY,JSON.stringify(next));
      return next;
    });
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
    const items=cands.map(({res})=>({id:res.id??res.db_id,name:res.guest_name||res.name||"Guest",room:res.room||res.venue||"",eventDate:res.event_date||res.eventDate||res.reservationDate,eventTime:res.event_time||res.eventTime||res.reservationTime}));
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

  const outletOptions=useMemo(()=>["ALL",...Array.from(new Set(allCards.map(getOutletName))).sort((a,b)=>a.localeCompare(b))],[allCards]);

  const{upcomingCards,pendingCards,acceptedCards,declinedCards}=useMemo(()=>{
    const u=[],p=[],a=[],x=[];
    allCards.filter(res=>outletFilter==="ALL"||getOutletName(res)===outletFilter).forEach(res=>{
      if(isPending(res)){p.push(res);return;}
      if(isDeclined(res)){x.push(res);return;}
      if(!isApproved(res))return;
      a.push(res);
      const dt=parseEventDate(res.event_date||res.eventDate||res.reservationDate,res.event_time||res.eventTime||res.reservationTime);
      if(!dt||dt.getTime()>Date.now())u.push(res);
    });
    return{upcomingCards:u,pendingCards:p,acceptedCards:a,declinedCards:x};
  },[allCards,outletFilter]);

  const leftCards=leftTab==="upcoming"?upcomingCards:pendingCards;
  const rightCards=rightTab==="declined"?declinedCards:acceptedCards;
  const leftVisible=leftCards.slice((pendingPage-1)*pendingPerPage,pendingPage*pendingPerPage);
  const doneVisible=rightCards.slice((donePage-1)*donePerPage,donePage*donePerPage);
  const {activeAlerts,acknowledgedAlerts}=useMemo(()=>{
    const now=Date.now();
    const active=allCards
      .filter(isApproved)
      .map(res=>{
        const id=notificationId(res);
        const dt=parseEventDate(res.event_date||res.eventDate||res.reservationDate,res.event_time||res.eventTime||res.reservationTime);
        if(!id||!dt||acknowledgments[id])return null;
        const diff=dt.getTime()-now;
        if(diff<=0||diff>2*3_600_000)return null;
        return {id,name:res.guest_name||res.name||"Guest",room:getOutletName(res),eventDate:res.event_date||res.eventDate||res.reservationDate,eventTime:res.event_time||res.eventTime||res.reservationTime};
      })
      .filter(Boolean);
    return {activeAlerts:active,acknowledgedAlerts:Object.values(acknowledgments)};
  },[allCards,acknowledgments]);

  const handlePopupView=useCallback(p=>{dismissPopup();const items=p.items||[];if(items.length===1){const full=allCards.find(r=>(r.id??r.db_id)===items[0].id);if(full)setDetailRes(full);}else setPickerItems(items);},[allCards,dismissPopup]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        @keyframes spin{to{transform:rotate(360deg);}}
        @keyframes modalIn{from{opacity:0;transform:translateY(12px) scale(0.97);}to{opacity:1;transform:none;}}
        @keyframes cardSlideIn{from{opacity:0;transform:translateY(-8px) scale(0.98);}to{opacity:1;transform:none;}}
        @keyframes bellRing{0%,100%{transform:rotate(0deg);}25%{transform:rotate(-16deg);}75%{transform:rotate(16deg);}}
        @keyframes dotPulse{0%,100%{opacity:1;transform:scale(1);}50%{opacity:0.3;transform:scale(1.8);}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(16px);}to{opacity:1;transform:translateY(0);}}
        @media (max-width: 768px) {
          .nd-grid { grid-template-columns: 1fr !important; }
        }
        ::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:transparent;}::-webkit-scrollbar-thumb{background:rgba(0,0,0,0.10);border-radius:4px;}
      `}</style>

      <div style={{ minHeight:"100vh",fontFamily:F.body,background:C.pageBg,color:C.textPrimary,display:"flex",flexDirection:"column",position:"relative" }}>

        <div style={{ position:"fixed",inset:0,zIndex:0 }}>
          <div style={{ position:"absolute",inset:0,backgroundImage:"url('/src/assets/bg-login.jpeg')",backgroundSize:"cover",backgroundPosition:"center",filter:C.bgFilter,transform:"scale(1.05)",transition:"filter 0.40s" }}/>
          <div style={{ position:"absolute",inset:0,background:C.bgOverlay,transition:"background 0.40s" }}/>
        </div>

        <nav style={{ position:"fixed",top:0,left:0,right:0,zIndex:9000,height:64,display:"flex",alignItems:"center",justifyContent:"space-between",padding:"0 clamp(20px,5vw,64px)",background:C.navBg,backdropFilter:"blur(24px)",WebkitBackdropFilter:"blur(24px)",borderBottom:`1px solid ${C.navBorder}`,boxSizing:"border-box" }}>
          <div style={{ display:"flex",alignItems:"center",gap:20 }}>
            <img src={bellevueLogo} alt="The Bellevue Manila" style={{ height:26,width:"auto",display:"block",flexShrink:0,filter:"brightness(0) saturate(100%)" }}/>
          </div>
          <div style={{ display:"flex",alignItems:"center",gap:10 }}>
            <div style={{ width:36,height:36,borderRadius:"50%",background:popup?C.goldFaint:C.surfaceInput,border:`1px solid ${popup?C.borderAccent:C.borderDefault}`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,transition:"all 0.2s",position:"relative",animation:popup?"bellRing 0.6s ease infinite":"none" }}>
              {popup?<BellDot size={15} color={C.gold}/>:<Bell size={15} color={C.textSecondary}/>}
              {popup&&<div style={{ position:"absolute",top:3,right:3,width:7,height:7,borderRadius:"50%",background:C.red,border:`1.5px solid ${C.surfaceBase}`,animation:"dotPulse 1.2s ease infinite" }}/>}
            </div>
          </div>
        </nav>

        <div style={{ position:"relative",zIndex:1,paddingTop:64,minHeight:"100vh",display:"flex",flexDirection:"column" }}>
          {loading&&(
            <div style={{ flex:1,display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:16 }}>
              <Spinner C={C} size={22}/>
              <div style={{ fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:C.textTertiary }}>Loading…</div>
            </div>
          )}

          {!loading&&(
            <div style={{ flex:1,display:"flex",flexDirection:"column",padding:"clamp(32px,5vh,52px) clamp(20px,5vw,64px) clamp(24px,4vh,40px)",gap:20,animation:"fadeUp 0.32s ease" }}>
              <div>
                <h1 style={{ fontFamily:F.display,fontSize:"clamp(24px,4vw,40px)",fontWeight:700,color:C.textPrimary,lineHeight:1.12,margin:"0 0 8px",letterSpacing:"0.01em" }}>
                  Notification Monitor
                </h1>
                <select value={outletFilter} onChange={e=>{setOutletFilter(e.target.value);setPendingPage(1);setDonePage(1);}} style={{ marginBottom:8,padding:"6px 10px",border:`1px solid ${C.borderDefault}`,borderRadius:6,background:C.surfaceBase,fontFamily:F.label,fontSize:10,fontWeight:700,letterSpacing:"0.10em",textTransform:"uppercase",color:C.textSecondary,outline:"none" }}>
                  {outletOptions.map(outlet=><option key={outlet} value={outlet}>{outlet==="ALL"?"All Outlets":outlet}</option>)}
                </select>
                <div style={{ fontFamily:F.label,fontSize:11,fontWeight:500,color:C.textSecondary,letterSpacing:"0.02em",textTransform:"uppercase" }}>
                  {new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: true })} • {new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </div>
              </div>

              <div style={{ display:"grid",gridTemplateColumns:"minmax(0,3fr) minmax(0,1.4fr)",gap:14,flex:1,minHeight:0 }} className="nd-grid">
                <div style={{ gridColumn:"1 / -1" }}>
                  <AcknowledgmentMonitor activeAlerts={activeAlerts} acknowledgedAlerts={acknowledgedAlerts} onAcknowledge={acknowledgeAlerts} canAcknowledge={canAcknowledgeNotifications} C={C}/>
                </div>

                {/* LEFT */}
                <Panel C={C} style={{ maxHeight:"clamp(360px, calc(100vh - 280px), 700px)" }}>
                  <div style={{ padding:"12px 16px 10px",borderBottom:`1px solid ${C.divider}`,flexShrink:0 }}>
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                      <div style={{ display:"flex",gap:6 }}>
                        <TabBtn active={leftTab==="pending"} onClick={()=>{setLeftTab("pending");setPendingPage(1);}} activeColor={C.gold} count={pendingCards.length} pulse={pendingCards.length>0} C={C}><Clock size={10}/>Pending</TabBtn>
                        <TabBtn active={leftTab==="upcoming"} onClick={()=>{setLeftTab("upcoming");setPendingPage(1);}} activeColor={C.blue} count={upcomingCards.length} C={C}><CalendarDays size={10}/>Upcoming</TabBtn>
                      </div>
                      <span style={{ fontFamily:F.label,fontSize:9,color:C.textTertiary,letterSpacing:"0.10em",textTransform:"uppercase" }}>{leftTab==="pending"?"Tap approve to confirm":"Approved · not yet passed"}</span>
                    </div>
                  </div>
                  <div ref={leftRef} style={{ flex:1,overflowY:"auto",padding:"10px 12px",minHeight:0 }}>
                    {leftCards.length===0
                      ? <EmptyState msg={leftTab==="upcoming"?"No upcoming reservations":"No pending reservations"} C={C}/>
                      : leftVisible.map(res=>(
                          <ReservationCard
                            key={res.id??res.db_id}
                            res={res}
                            isNew={newIds.has(res.id??res.db_id)}
                            onClick={setDetailRes}
                            onApprove={handleApproveRequest}
                            onDecline={handleDeclineRequest}
                            approvingIds={approvingIds}
                            decliningIds={decliningIds}
                            canManage={canManageReservations}
                            C={C}
                          />
                        ))
                    }
                  </div>
                  <Pagination page={pendingPage} total={leftCards.length} perPage={pendingPerPage} setPage={setPendingPage} setPerPage={setPendingPerPage} C={C}/>
                </Panel>

                {/* RIGHT */}
                <Panel accentColor={rightTab==="declined"?C.red:C.green} C={C} style={{ maxHeight:"clamp(360px, calc(100vh - 280px), 700px)" }}>
                  <div style={{ padding:"12px 16px 10px",borderBottom:`1px solid ${C.divider}`,flexShrink:0 }}>
                    <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between" }}>
                      <div style={{ display:"flex",gap:6 }}>
                        <TabBtn active={rightTab==="accepted"} onClick={()=>{setRightTab("accepted");setDonePage(1);}} activeColor={C.green} count={acceptedCards.length} C={C}><CheckCircle size={10}/>Accepted</TabBtn>
                        <TabBtn active={rightTab==="declined"} onClick={()=>{setRightTab("declined");setDonePage(1);}} activeColor={C.red} count={declinedCards.length} C={C}><XCircle size={10}/>Declined</TabBtn>
                      </div>
                      <span style={{ fontFamily:F.label,fontSize:9,color:C.textTertiary,letterSpacing:"0.10em",textTransform:"uppercase" }}>{rightTab==="declined"?"Rejected reservations":"Approved reservations"}</span>
                    </div>
                  </div>
                  <div style={{ flex:1,overflowY:"auto",padding:"10px 12px",minHeight:0 }}>
                    {rightCards.length===0
                      ? <EmptyState msg={rightTab==="declined"?"No declined reservations":"No accepted reservations"} C={C}/>
                      : doneVisible.map(res=>(
                          <DoneCard key={`done-${res.id??res.db_id}`} res={res} onClick={setDetailRes} C={C}/>
                        ))
                    }
                  </div>
                  <Pagination page={donePage} total={rightCards.length} perPage={donePerPage} setPage={setDonePage} setPerPage={setDonePerPage} C={C}/>
                </Panel>

              </div>
            </div>
          )}
        </div>
      </div>

      {popup&&<ReminderPopup popup={popup} queueCount={popupQueue.length} onView={handlePopupView} onClose={dismissPopup} onAcknowledge={acknowledgeAlerts} canAcknowledge={canAcknowledgeNotifications} C={C}/>}
      {pickerItems&&<EventPickerModal items={pickerItems} allCards={allCards} onSelect={r=>{setPickerItems(null);setDetailRes(r);}} onClose={()=>setPickerItems(null)} C={C}/>}
      {detailRes&&<DetailModal res={detailRes} onClose={()=>setDetailRes(null)} onApprove={handleApproveRequest} onDecline={handleDeclineRequest} approvingIds={approvingIds} decliningIds={decliningIds} canManage={canManageReservations} C={C}/>}
      {confirmRes&&<ApproveConfirmModal res={confirmRes} onConfirm={handleApproveConfirm} onCancel={()=>{if(!isApproving)setConfirmRes(null);}} isApproving={isApproving} C={C}/>}
      {declineRes&&<DeclineConfirmModal res={declineRes} onConfirm={handleDeclineConfirm} onCancel={()=>{if(!isDeclining)setDeclineRes(null);}} isDeclining={isDeclining} C={C}/>}
      <Toast toasts={toasts} C={C}/>
    </>
  );
}

export default NotificationDashboard;
