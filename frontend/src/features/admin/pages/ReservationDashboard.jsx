// src/features/admin/pages/ReservationDashboard.jsx

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import Sidebar from "../../../components/layout/Sidebar";
import { fetchReservations, approveReservation, rejectReservation, revertReservation, getReservationStats } from "../../../utils/api";
import { authAPI } from "../../../services/authAPI";

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
  const map={pending:C.badgePending,approved:C.badgeApproved,rejected:C.badgeRejected,cancelled:C.badgeRejected};
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

// ─── Room Filter Dropdown ─────────────────────────────────────────────────────
function RoomFilterDropdown({ rooms, selectedRoom, onSelect, isMobile }) {
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = selectedRoom === "ALL" ? "All Rooms" : selectedRoom;
  const hasFilter = selectedRoom !== "ALL";

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "7px 11px",
          background: hasFilter ? C.goldFaint : C.surfaceBase,
          border: `1.5px solid ${open || focused ? C.borderAccent : hasFilter ? C.gold + "55" : C.borderDefault}`,
          borderRadius: 8,
          fontFamily: F.label,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: hasFilter ? C.gold : C.textSecondary,
          cursor: "pointer",
          transition: "all 0.18s",
          whiteSpace: "nowrap",
          boxShadow: open ? C.inputFocusShadow : "none",
          minWidth: isMobile ? 120 : 148,
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.borderColor = C.borderAccent;
            e.currentTarget.style.color = C.gold;
          }
        }}
        onMouseLeave={(e) => {
          if (!open && !focused) {
            e.currentTarget.style.borderColor = hasFilter ? C.gold + "55" : C.borderDefault;
            e.currentTarget.style.color = hasFilter ? C.gold : C.textSecondary;
          }
        }}
      >
        {/* Room icon */}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span style={{ flex: 1, textAlign: "left", maxWidth: isMobile ? 80 : 100, overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
        {/* Chevron */}
        <svg
          width="9" height="9" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round"
          style={{ transition: "transform 0.18s", transform: open ? "rotate(180deg)" : "rotate(0deg)", flexShrink: 0 }}
        >
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 6px)",
          left: 0,
          zIndex: 500,
          background: C.surfaceBase,
          border: `1px solid ${C.borderDefault}`,
          borderRadius: 10,
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
          minWidth: 200,
          maxWidth: 280,
          maxHeight: 320,
          overflowY: "auto",
          animation: "dropdownIn 0.16s cubic-bezier(0.16,1,0.3,1)",
          padding: "6px 0",
        }}>
          {/* All Rooms option */}
          <button
            onClick={() => { onSelect("ALL"); setOpen(false); }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              width: "100%",
              padding: "8px 14px",
              background: selectedRoom === "ALL" ? C.goldFaint : "transparent",
              border: "none",
              textAlign: "left",
              fontFamily: F.label,
              fontSize: 10,
              fontWeight: selectedRoom === "ALL" ? 700 : 600,
              letterSpacing: "0.10em",
              textTransform: "uppercase",
              color: selectedRoom === "ALL" ? C.gold : C.textSecondary,
              cursor: "pointer",
              transition: "background 0.12s",
            }}
            onMouseEnter={(e) => { if (selectedRoom !== "ALL") e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
            onMouseLeave={(e) => { if (selectedRoom !== "ALL") e.currentTarget.style.background = "transparent"; }}
          >
            {selectedRoom === "ALL" && (
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            )}
            {selectedRoom !== "ALL" && <span style={{ width: 9 }} />}
            All Rooms
          </button>

          {rooms.length > 0 && (
            <div style={{ height: 1, background: C.divider, margin: "4px 10px" }} />
          )}

          {rooms.map((room) => (
            <button
              key={room}
              onClick={() => { onSelect(room); setOpen(false); }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                width: "100%",
                padding: "8px 14px",
                background: selectedRoom === room ? C.goldFaint : "transparent",
                border: "none",
                textAlign: "left",
                fontFamily: F.body,
                fontSize: 12,
                fontWeight: selectedRoom === room ? 600 : 400,
                color: selectedRoom === room ? C.gold : C.textPrimary,
                cursor: "pointer",
                transition: "background 0.12s",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
              onMouseEnter={(e) => { if (selectedRoom !== room) e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
              onMouseLeave={(e) => { if (selectedRoom !== room) e.currentTarget.style.background = "transparent"; }}
            >
              {selectedRoom === room ? (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <span style={{ width: 9 }} />
              )}
              {room}
            </button>
          ))}

          {rooms.length === 0 && (
            <div style={{ padding: "10px 14px", fontFamily: F.body, fontSize: 12, color: C.textTertiary }}>
              No rooms found
            </div>
          )}
        </div>
      )}
    </div>
  );
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
function DetailModal({ reservation, onClose, onApprove, onReject, onRevert, canManage }) {
  const [actionLoading,setActionLoading]=useState(null);
  const [showRejectModal,setShowRejectModal]=useState(false);
  const [showRevertModal,setShowRevertModal]=useState(false);
  const [showApproveModal,setShowApproveModal]=useState(false);

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

  return (
    <>
      <div
        style={{
          position:"fixed",inset:0,
          background:C.modalOverlay,
          zIndex:4000,
          display:"flex",alignItems:"center",justifyContent:"center",
          padding:20,
          backdropFilter:"blur(4px)",WebkitBackdropFilter:"blur(4px)",
        }}
        onClick={(e)=>{if(e.target===e.currentTarget&&!actionLoading)onClose();}}
      >
        <div style={{
          background:C.surfaceBase,borderRadius:14,
          width:"100%",maxWidth:520,
          maxHeight:"92vh",
          boxShadow:"0 24px 80px rgba(0,0,0,0.16)",
          border:`1px solid ${C.borderDefault}`,
          fontFamily:F.body,
          animation:"modalIn 0.20s cubic-bezier(0.16,1,0.3,1)",
          overflow:"hidden",
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
            <SectionLabel>Reservation Details</SectionLabel>
            {resRows.map(([label,value],i,arr)=>(
              <div key={label} style={{
                display:"flex",justifyContent:"space-between",alignItems:"flex-start",
                padding:"8px 0",
                borderBottom:i<arr.length-1?`1px solid ${C.divider}`:"none",
              }}>
                <span style={{fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary,minWidth:100,flexShrink:0}}>{label}</span>
                <span style={{fontFamily:F.body,fontSize:12.5,color:label==="Reference"?C.gold:C.textPrimary,fontWeight:label==="Reference"?700:500,textAlign:"right",maxWidth:280,lineHeight:1.5,letterSpacing:label==="Reference"?"0.06em":"normal"}}>{value}</span>
              </div>
            ))}

            <SectionLabel style={{marginTop:18}}>Guest Information</SectionLabel>
            {guestRows.map(([label,value],i,arr)=>(
              <div key={label} style={{
                display:"flex",justifyContent:"space-between",alignItems:"flex-start",
                padding:"8px 0",
                borderBottom:i<arr.length-1?`1px solid ${C.divider}`:"none",
              }}>
                <span style={{fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary,minWidth:100,flexShrink:0}}>{label}</span>
                <span style={{fontFamily:F.body,fontSize:12.5,color:C.textPrimary,fontWeight:500,textAlign:"right",maxWidth:280,lineHeight:1.5}}>{value}</span>
              </div>
            ))}

            <SectionLabel style={{marginTop:18}}>Status Tracking</SectionLabel>
            {trackingRows.map(([label,value],i,arr)=>(
              <div key={label} style={{
                display:"flex",justifyContent:"space-between",alignItems:"flex-start",
                padding:"8px 0",
                borderBottom:i<arr.length-1?`1px solid ${C.divider}`:"none",
              }}>
                <span style={{fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.14em",textTransform:"uppercase",color:C.textTertiary,minWidth:120,flexShrink:0}}>{label}</span>
                <span style={{fontFamily:F.body,fontSize:12.5,color:C.textPrimary,fontWeight:500,textAlign:"right",maxWidth:260,lineHeight:1.5,textTransform:label==="Previous Status"&&value!=="—"?"capitalize":"none"}}>{value}</span>
              </div>
            ))}

            <SectionLabel style={{marginTop:18}}>Reservation History</SectionLabel>
            {historyItems.length ? historyItems.map((item,i)=>(
              <div key={item.id || `${item.action}-${i}`} style={{
                padding:"9px 0",
                borderBottom:i<historyItems.length-1?`1px solid ${C.divider}`:"none",
              }}>
                <div style={{display:"flex",justifyContent:"space-between",gap:12,alignItems:"flex-start"}}>
                  <span style={{fontFamily:F.body,fontSize:12.5,fontWeight:700,color:C.textPrimary,lineHeight:1.4}}>{formatHistoryAction(item.action)}</span>
                  <span style={{fontFamily:F.body,fontSize:11,color:C.textSecondary,textAlign:"right",whiteSpace:"nowrap"}}>{fmtDateTime(item.created_at)}</span>
                </div>
                <div style={{fontFamily:F.body,fontSize:11.5,color:C.textSecondary,lineHeight:1.5,marginTop:3}}>
                  {(item.from_status || item.to_status) && (
                    <span style={{textTransform:"capitalize"}}>{item.from_status || "-"} {"->"} {item.to_status || "-"}</span>
                  )}
                  {item.notes ? <span>{item.from_status || item.to_status ? " - " : ""}{item.notes}</span> : null}
                </div>
              </div>
            )) : (
              <div style={{fontFamily:F.body,fontSize:12,color:C.textSecondary,lineHeight:1.5}}>
                No transaction history recorded yet.
              </div>
            )}

            {isPending && canManage ? (
              <div style={{display:"flex",gap:8,marginTop:22}}>
                <button
                  onClick={()=>setShowRejectModal(true)}
                  disabled={!!actionLoading}
                  style={{
                    flex:1,padding:"11px",
                    background:"transparent",border:`1px solid ${C.redBorder}`,
                    borderRadius:8,fontFamily:F.label,fontSize:10,fontWeight:700,
                    letterSpacing:"0.14em",textTransform:"uppercase",
                    color:C.red,cursor:actionLoading?"not-allowed":"pointer",
                    transition:"all 0.18s",
                    display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                    opacity:actionLoading==="approve"?0.5:1,
                  }}
                  onMouseEnter={(e)=>{if(!actionLoading)e.currentTarget.style.background=C.redFaint;}}
                  onMouseLeave={(e)=>{if(!actionLoading)e.currentTarget.style.background="transparent";}}
                >
                  {actionLoading==="reject"?<><Spinner/>Rejecting…</>:"Reject"}
                </button>
                <button
                  onClick={()=>setShowApproveModal(true)}
                  disabled={!!actionLoading}
                  style={{
                    flex:2,padding:"11px",border:"none",borderRadius:8,
                    background:actionLoading?"rgba(46,122,90,0.45)":C.green,
                    color:"#fff",fontFamily:F.label,fontSize:10,fontWeight:700,
                    letterSpacing:"0.14em",textTransform:"uppercase",
                    cursor:actionLoading?"not-allowed":"pointer",transition:"all 0.18s",
                    display:"flex",alignItems:"center",justifyContent:"center",gap:7,
                  }}
                  onMouseEnter={(e)=>{if(!actionLoading)e.currentTarget.style.background="#256648";}}
                  onMouseLeave={(e)=>{if(!actionLoading)e.currentTarget.style.background=C.green;}}
                >
                  {actionLoading==="approve"?<><Spinner/>Approving…</>:"Approve & Notify"}
                </button>
              </div>
            ) : (
              <>
                <div style={{
                  marginTop:18,padding:"10px 14px",borderRadius:8,
                  background:C.statusNote[(reservation.status||"pending").toLowerCase()]||C.goldFaintest,
                  border:`1px solid ${C.statusNoteBorder[(reservation.status||"pending").toLowerCase()]||C.borderAccent}`,
                  fontFamily:F.body,fontSize:12,color:C.textSecondary,lineHeight:1.6,
                }}>
                  {canManage
                    ? <>This reservation has been <strong style={{color:C.textPrimary}}>{(reservation.status||"").toLowerCase()}</strong>{isRejected ? " and can be reverted to pending review." : " and cannot be modified."}</>
                    : <>Your account can view this reservation, but cannot modify it.</>}
                </div>
                {isRejected&&canManage&&(
                  <button
                    onClick={()=>setShowRevertModal(true)}
                    disabled={!!actionLoading}
                    style={{
                      width:"100%",marginTop:10,padding:"11px",
                      border:"none",borderRadius:8,
                      background:actionLoading?"rgba(140,107,42,0.45)":C.gold,
                      color:"#fff",fontFamily:F.label,fontSize:10,fontWeight:700,
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
              </>
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
  const canManageReservations = authAPI.hasPermission("manage_reservations");
  const canDeleteReservations = authAPI.hasPermission("delete_reservations");
  const [reservations,setReservations]=useState([]);
  const [filteredReservations,setFilteredReservations]=useState([]);
  const [filterStatus,setFilterStatus]=useState("ALL");
  const [filterRoom,setFilterRoom]=useState("ALL");           // ← NEW
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

  const pollingRef = useRef(null);

  const [windowWidth,setWindowWidth]=useState(window.innerWidth);
  useEffect(()=>{
    const h=()=>setWindowWidth(window.innerWidth);
    window.addEventListener("resize",h);
    return()=>window.removeEventListener("resize",h);
  },[]);

  const isMobile=windowWidth<640;
  const isTablet=windowWidth<960;

  // ─── Master room list + any extra rooms found in reservations ───────────────
  const roomOptions = useMemo(() => {
    const PINNED = ["Alabang Function Room"];
    const REST = [
      "Grand Ballroom A",
      "Grand Ballroom B",
      "Grand Ballroom C",
      "Laguna Ballroom 1",
      "Laguna Ballroom 2",
      "Tower Ballroom 1",
      "Tower Ballroom 2",
      "Tower Ballroom 3",
      "Tower 1",
      "Tower 2",
      "Tower 3",
      "20/20 Function Room A",
      "20/20 Function Room B",
      "20/20 Function Room C",
      "Business Center",
      "Qsina",
      "Hanakazu",
      "Phoenix Court",
    ];
    const fromReservations = reservations
      .map(r => r.room?.trim())
      .filter(Boolean);
    const pinnedSet = new Set(PINNED);
    const masterSet = new Set([...PINNED, ...REST]);
    // Only add rooms from DB that aren't already in the master list
    const extras = Array.from(new Set(fromReservations))
      .filter(r => !masterSet.has(r))
      .sort((a, b) => a.localeCompare(b));
    return [...PINNED, ...REST, ...extras];
  }, [reservations]);

  const refreshDashboardData = useCallback(async (silent = true) => {
    if (!silent) setLoading(true);
    try {
      const [reservationsData, statsData] = await Promise.all([
        fetchReservations(1, 9999),
        getReservationStats(),
      ]);
      const rows = Array.isArray(reservationsData)
        ? reservationsData
        : Array.isArray(reservationsData?.data)
          ? reservationsData.data
          : [];
      setReservations(rows);
      if (statsData) setStats(statsData);
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
    let filtered=reservations;

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
      filtered=filtered.filter((r)=>
        (r.room||"").trim()===filterRoom
      );
    }

    if(search.trim()){
      const q=search.toLowerCase();
      filtered=filtered.filter((r)=>
        r.name?.toLowerCase().includes(q)||
        r.email?.toLowerCase().includes(q)||
        r.reference_code?.toLowerCase().includes(q)||
        (q==="standalone"&&(String(r.table_number||"").toUpperCase()==="STANDALONE"||r.type==="standalone"))
      );
    }

    setFilteredReservations(filtered);
    setPagination((p)=>({
      ...p,
      lastPage: Math.max(1, Math.ceil(filtered.length / p.rowsPerPage)),
      totalItems: filtered.length,
      currentPage: 1,
    }));
  },[reservations,filterStatus,filterRoom,search]);

  useEffect(()=>{
    const total    = reservations.length;
    const pending  = reservations.filter(r=>r.status?.toLowerCase()==="pending").length;
    const approved = reservations.filter(r=>r.status?.toLowerCase()==="approved"||r.status?.toLowerCase()==="reserved").length;
    const rejected = reservations.filter(r=>r.status?.toLowerCase()==="rejected").length;
    const active = reservations.filter(r=>getReservationState(r)==="active").length;
    const inactive = reservations.filter(r=>getReservationState(r)==="inactive").length;
    setStats({total,pending,approved,rejected,active,inactive});
  },[reservations]);

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
        setReservations(prev =>
          prev.map(r => r.id === reservation.id ? {
            ...r,
            status: result.status || "reserved",
            reservation_state: "active",
            previous_status: result.previous_status || reservation.status,
            status_last_changed_at: result.status_last_changed_at || new Date().toISOString(),
            transaction_history: result.transaction_history || r.transaction_history
          } : r)
        );
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
        setReservations(prev =>
          prev.map(r => r.id === reservation.id ? {
            ...r,
            status: "rejected",
            reservation_state: "inactive",
            previous_status: reservation.status,
            status_last_changed_at: result.status_last_changed_at || now,
            rejected_at: result.rejected_at || now,
            rejection_reason: reason,
            transaction_history: result.transaction_history || r.transaction_history
          } : r)
        );
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
        setReservations(prev =>
          prev.map(r => r.id === reservation.id ? {
            ...r,
            status: "pending",
            reservation_state: "active",
            previous_status: reservation.status,
            status_last_changed_at: result.status_last_changed_at || now,
            reverted_at: result.reverted_at || now,
            transaction_history: result.transaction_history || r.transaction_history
          } : r)
        );
        optimisticSeatUpdate(reservation, "pending");
        setToast({ message: "Reservation reverted to pending review.", type: "success" });
      } else {
        setToast({ message: result.message || "Failed to revert reservation", type: "error" });
      }
    } catch {
      setToast({ message: "Error reverting reservation", type: "error" });
    }
  };

  const statCards=[
    {label:"Total",    count:stats.total,    filter:"ALL",      color:C.gold,               bg:C.goldFaint,           border:C.borderAccent              },
    {label:"Pending",  count:stats.pending,  filter:"PENDING",  color:C.badgePending.color,  bg:C.statusNote.pending,  border:C.statusNoteBorder.pending  },
    {label:"Approved", count:stats.approved, filter:"APPROVED", color:C.badgeApproved.color, bg:C.statusNote.approved, border:C.statusNoteBorder.approved },
    {label:"Rejected", count:stats.rejected, filter:"REJECTED", color:C.badgeRejected.color, bg:C.statusNote.rejected, border:C.statusNoteBorder.rejected },
    {label:"Active",   count:stats.active,   filter:"ACTIVE",   color:C.green,              bg:C.greenFaint,          border:C.greenBorder               },
    {label:"Inactive", count:stats.inactive, filter:"INACTIVE", color:C.textSecondary,      bg:"rgba(0,0,0,0.04)",    border:C.borderDefault             },
  ];

  const pagedReservations=filteredReservations.slice(
    (pagination.currentPage-1)*pagination.rowsPerPage,
    pagination.currentPage*pagination.rowsPerPage
  );

  // Whether any filter is active (for "clear all" affordance)
  const hasActiveFilters = filterStatus !== "ALL" || filterRoom !== "ALL" || search.trim() !== "";

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
        @keyframes dropdownIn { from { opacity:0; transform:translateY(-6px) scale(0.98); } to { opacity:1; transform:translateY(0) scale(1); } }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(0,0,0,0.12); border-radius:4px; }
      `}</style>

      <div style={{minHeight:"100vh",fontFamily:F.body,background:C.pageBg,color:C.textPrimary}}>
        <AdminNavbar onLogout={handleLogout}/>

        <div style={{display:"flex",minHeight:"100vh"}}>
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
              display:"flex",alignItems:"center",
              justifyContent:"space-between",
              gap:10,flexWrap:isMobile?"wrap":"nowrap",
            }}>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontFamily:F.label,fontSize:9,letterSpacing:"0.20em",color:C.gold,fontWeight:700,textTransform:"uppercase"}}>Admin</span>
                <span style={{color:C.textTertiary,fontSize:11}}>·</span>
                <span style={{fontFamily:F.label,fontSize:9,letterSpacing:"0.14em",color:C.textSecondary,fontWeight:600,textTransform:"uppercase"}}>Reservation Management</span>
              </div>

              {/* ── Search + Room filter in navbar ── */}
              <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:isMobile?"wrap":"nowrap"}}>
                {/* Room filter dropdown */}
                <RoomFilterDropdown
                  rooms={roomOptions}
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

            <div style={{padding:isMobile?"20px 16px":isTablet?"24px 20px":"28px 32px",animation:"fadeUp 0.28s ease"}}>

              <div style={{marginBottom:isMobile?18:22}}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <span style={{display:"inline-block",width:22,height:"1px",background:C.gold,opacity:0.6}}/>
                  <span style={{fontFamily:F.label,fontSize:9,letterSpacing:"0.26em",color:C.gold,fontWeight:700,textTransform:"uppercase"}}>Dashboard</span>
                </div>
                <h1 style={{fontFamily:F.display,fontSize:isMobile?22:isTablet?28:34,fontWeight:700,color:C.textPrimary,lineHeight:1.15,margin:"0 0 6px",letterSpacing:"0.01em"}}>
                  Reservation Dashboard
                </h1>
                <p style={{fontFamily:F.body,fontSize:13,color:C.textSecondary,margin:0,lineHeight:1.65}}>
                  Manage and review all reservation requests
                </p>
              </div>

              {/* ── Stat cards ── */}
              <div style={{display:"grid",gridTemplateColumns:isMobile?"repeat(2,1fr)":"repeat(4,1fr)",gap:isMobile?10:12,marginBottom:isMobile?18:22}}>
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
                        boxShadow:active?`0 4px 18px ${color}1A`:"0 1px 4px rgba(0,0,0,0.05)",
                        transform:active?"translateY(-1px)":"translateY(0)",
                      }}
                      onMouseEnter={(e)=>{if(!active){e.currentTarget.style.borderColor=border;e.currentTarget.style.transform="translateY(-2px)";e.currentTarget.style.boxShadow=`0 6px 18px ${color}14`;}}}
                      onMouseLeave={(e)=>{if(!active){e.currentTarget.style.borderColor=C.cardBorder;e.currentTarget.style.transform="translateY(0)";e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.05)";}}}
                    >
                      <div style={{fontFamily:F.display,fontSize:isMobile?28:36,fontWeight:700,color:color,lineHeight:1,marginBottom:isMobile?6:8,letterSpacing:"-0.02em"}}>
                        {loading?"—":count}
                      </div>
                      <div style={{fontFamily:F.label,fontSize:9,color:active?color:C.textTertiary,fontWeight:700,textTransform:"uppercase",letterSpacing:"0.14em",transition:"color 0.18s"}}>
                        {label}
                      </div>
                      {active&&(
                        <div style={{display:"inline-flex",alignItems:"center",gap:4,marginTop:6,fontFamily:F.label,fontSize:8,fontWeight:700,color:color,letterSpacing:"0.10em",textTransform:"uppercase"}}>
                          <span style={{width:4,height:4,borderRadius:"50%",background:color}}/>
                          Active Filter
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* ── Table card ── */}
              <div style={{background:C.cardBg,borderRadius:12,border:`1px solid ${C.cardBorder}`,overflow:"hidden",boxShadow:"0 2px 10px rgba(0,0,0,0.06)"}}>

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
                    <div style={{fontFamily:F.label,fontSize:9,letterSpacing:"0.26em",color:C.gold,fontWeight:700,textTransform:"uppercase"}}>Reservations</div>
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
                          onClick={() => { setFilterStatus("ALL"); setFilterRoom("ALL"); setSearch(""); }}
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
                              </div>
                              <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:7,flexShrink:0}}>
                                <StatusBadge status={reservation.status}/>
                                <StateBadge state={getReservationState(reservation)}/>
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
            canManage={canManageReservations}
          />
        )}
      </div>
    </>
  );
}
