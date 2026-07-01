// src/features/admin/pages/CancelledDashboard.jsx
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
import Sidebar from "../../../components/layout/Sidebar";
import { venueAPI } from "../../../services/venueAPI";
import { buildOutletGroupsFromVenues, buildDynamicOutletTree, resolveOutletChildren } from "../../../constants/outletCatalog";
import { useAdminTheme, C, F } from "../../../context/AdminThemeContext";

import RoomFilterDropdown from "../components/RoomFilterDropdown";
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "http://localhost:8000/api" : `${window.location.protocol}//${window.location.host}/api`);



// ─── Helpers ──────────────────────────────────────────────────────────────────
function Spinner({ size = 13 }) {
  return (
    <span style={{
      display: "inline-block", width: size, height: size,
      border: `1.5px solid ${C.spinnerBorder}`,
      borderTopColor: C.spinnerTop,
      borderRadius: "50%", animation: "spin 0.65s linear infinite", flexShrink: 0,
    }} />
  );
}

function SectionLabel({ children, style = {} }) {
  return (
    <div style={{
      fontFamily: F.label, fontSize: 9, letterSpacing: "0.20em",
      color: C.gold, fontWeight: 700, textTransform: "uppercase",
      marginBottom: 14, paddingBottom: 8,
      borderBottom: `1px solid ${C.divider}`, ...style,
    }}>
      {children}
    </div>
  );
}

function CancelledBadge() {
  const badge = C.badgeCancelled;
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px 3px 7px",
      background: badge.bg,
      border: `1px solid ${badge.color}33`,
      borderRadius: 20,
      fontFamily: F.label, fontSize: 9, fontWeight: 700,
      letterSpacing: "0.12em", textTransform: "uppercase",
      color: badge.color, flexShrink: 0,
    }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: badge.dot, flexShrink: 0 }} />
      Cancelled
    </span>
  );
}

function metricTone(tone) {
  if (tone === "slate") return { color: C.accent, bg: C.accentFaint, border: C.accentBorder };
  if (tone === "green") return { color: C.green, bg: C.greenFaint, border: C.greenBorder };
  return { color: C.gold, bg: C.goldFaint, border: C.borderAccent };
}

function ReviewMetric({ label, value, helper, tone = "slate", active = false, onClick, isMobile, style = {} }) {
  const palette = metricTone(tone);
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        ...style,
        border: `1px solid ${active ? palette.border : C.cardBorder}`,
        borderRadius: 10,
        background: active ? palette.bg : C.surfaceBase,
        padding: isMobile ? "12px 14px" : "16px 18px",
        minHeight: isMobile ? 76 : 84,
        display: "grid",
        gap: 6,
        alignContent: "center",
        textAlign: "left",
        cursor: onClick ? "pointer" : "default",
        boxShadow: active ? `0 1px 5px ${palette.color}10` : "0 1px 3px rgba(24,20,14,0.025)",
        transition: "border-color 0.18s ease, box-shadow 0.18s ease, transform 0.18s ease, background 0.18s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = palette.border;
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = `0 2px 7px ${palette.color}10`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = active ? palette.border : C.cardBorder;
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = active ? `0 1px 5px ${palette.color}10` : "0 1px 3px rgba(24,20,14,0.025)";
      }}
    >
      <span style={{ fontFamily: F.label, fontSize: isMobile ? 8 : 8.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: active ? palette.color : C.textTertiary }}>
        {label}
      </span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontFamily: F.display, fontSize: isMobile ? 22 : 28, fontWeight: 760, lineHeight: 1, color: palette.color }}>
          {value}
        </span>
        <span style={{ fontSize: isMobile ? 10.5 : 11.5, color: C.textSecondary, lineHeight: 1.25, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {helper}
        </span>
      </span>
    </button>
  );
}

function InlineMetric({ label, value, tone = "slate" }) {
  const palette = metricTone(tone);
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 6,
      padding: "5px 9px",
      borderRadius: 999,
      background: palette.bg,
      border: `1px solid ${palette.border}`,
      color: palette.color,
      fontFamily: F.label,
      fontSize: 9,
      fontWeight: 800,
      letterSpacing: "0.10em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      <span style={{ color: palette.color, fontSize: 11, fontWeight: 800, letterSpacing: 0 }}>{value}</span>
      {label}
    </span>
  );
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function DetailModal({ reservation, onClose }) {
  const fmtDate = (d) => {
    if (!d) return "—";
    try { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }); }
    catch { return d; }
  };
  const fmtTime = (t) => {
    if (!t) return "—";
    if (typeof t === "string" && /AM|PM/i.test(t)) return t;
    const parts = t.split(":");
    if (parts.length < 2) return t;
    const hr = parseInt(parts[0]) || 0;
    const min = parts[1].substring(0, 2);
    return `${hr % 12 || 12}:${min} ${hr >= 12 ? "PM" : "AM"}`;
  };
  const fmtDateTime = (dt) => {
    if(!dt || dt === "—" || dt === "-") return"—";
    let parseValue = dt;
    if (typeof dt === 'string' && dt.includes(' ') && !dt.includes('T')) {
      parseValue = dt.replace(' ', 'T');
    }
    const d = new Date(parseValue);
    if(isNaN(d.getTime())) return "—";
    try {
      return d.toLocaleDateString("en-US", {
        year: "numeric", month: "long", day: "numeric",
        hour: "numeric", minute: "2-digit",
      });
    } catch { return dt; }
  };

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

  const cancelTx = Array.isArray(reservation.transactions)
    ? (reservation.transactions.find(t => ["cancelled_by_admin", "cancelled_by_guest"].includes(t.action))
      || reservation.transactions.find(t => t.to_status === "cancelled" && !["notification_sent", "notification_failed"].includes(t.action)))
    : null;
  const isCancelledByGuest = cancelTx ? cancelTx.action === "cancelled_by_guest" : true;
  const cancelledBy = cancelTx ? getActorLabel(cancelTx) : (reservation.cancelled_by || "Guest");

  const renderActivityTimeline = () => {
    const historyItems = Array.isArray(reservation.transactions)
      ? [...reservation.transactions].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
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
          if (item.action?.includes('approve') || item.action === 'status_changed' && item.to_status === 'reserved') {
            markerColor = C.green;
            markerBg = C.greenFaint;
          } else if (item.action?.includes('reject') || item.action?.includes('cancel')) {
            markerColor = C.accent;
            markerBg = C.accentFaint;
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
                      background: C.surfaceBase,
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

  const resRows = [
    ["Reference",  reservation.reference_code || "—"],
    ["Room",       reservation.room || reservation.venue?.name || "No room assigned"],
    ["Table",      reservation.table_number ? (String(reservation.table_number).toUpperCase() === "STANDALONE" ? "Standalone Seat" : `Table ${reservation.table_number}`) : "—"],
    ["Seat",       (reservation.seat || reservation.seat_number) ? (String(reservation.seat || reservation.seat_number).trim().toLowerCase().startsWith("seat") ? String(reservation.seat || reservation.seat_number).trim() : `Seat ${String(reservation.seat || reservation.seat_number).trim()}`) : "—"],
    ["Guests",     (reservation.guests_count || reservation.guests) ? `${reservation.guests_count || reservation.guests} guest${(reservation.guests_count || reservation.guests) !== 1 ? "s" : ""}` : "—"],
    ["Date Created", fmtDateTime(reservation.submittedTimestamp ? Number(reservation.submittedTimestamp) * 1000 : (reservation.created_at || reservation.createdAt || reservation.submitted_at || reservation.submittedAt))],
    ["Event Date", fmtDate(reservation.event_date)],
    ["Event Time", fmtTime(reservation.event_time)],
    ...((reservation.event_area || reservation.eventArea) ? [["Event Area", reservation.event_area || reservation.eventArea]] : []),
    ...((reservation.setup_tables ?? reservation.setupTables) ? [["Tables Needed", reservation.setup_tables ?? reservation.setupTables]] : []),
    ...((reservation.setup_chairs ?? reservation.setupChairs) ? [["Chairs Needed", reservation.setup_chairs ?? reservation.setupChairs]] : []),
    ...((reservation.setup_requirements || reservation.setupRequirements) ? [["Setup Requirements", reservation.setup_requirements || reservation.setupRequirements]] : []),
  ];

  const guestRows = [
    ["Full Name",  reservation.name || "—"],
    ["Email",      reservation.email || "—"],
    ["Phone",      reservation.phone || "—"],
    ["Special Requests", reservation.special_requests || "None"],
  ];

  return (
    <>
      <style>{`
        .modal-layout-grid {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 300px;
          gap: 20px;
          align-items: start;
        }
        .modal-scroll-body {
          padding: 18px 22px 24px;
          overflow-y: auto;
          flex: 1;
        }
        @media (max-width: 960px) {
          .modal-layout-grid {
            grid-template-columns: 1fr !important;
            gap: 16px !important;
          }
          .modal-scroll-body {
            padding: 14px 14px 20px !important;
          }
        }
      `}</style>
      <div
      style={{
        position: "fixed", inset: 0,
        background: C.modalOverlay,
        zIndex: 4000,
        display: "flex", justifyContent: "flex-end",
        backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)",
      }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: C.surfaceBase,
        width: "100%", maxWidth: 800,
        height: "100%",
        boxShadow: "-16px 0 40px rgba(0,0,0,0.16)",
        borderLeft: `1px solid ${C.borderDefault}`,
        fontFamily: F.body,
        animation: "drawerSlideIn 0.3s cubic-bezier(0.16,1,0.3,1)",
        display: "flex", flexDirection: "column",
      }}>
        <div style={{ height: 2, background: `linear-gradient(90deg,transparent 0%,${C.accent}80 30%,${C.accent}80 70%,transparent 100%)`, flexShrink: 0 }} />

        {/* Header */}
        <div style={{
          background: C.headerGradient,
          padding: "18px 22px 16px",
          borderBottom: `1px solid ${C.divider}`,
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          flexShrink: 0,
        }}>
          <div style={{ flex: 1, paddingRight: 14 }}>
            <div style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.22em", color: C.accent, fontWeight: 700, textTransform: "uppercase", marginBottom: 5, opacity: 0.85 }}>
              Cancelled Reservation
            </div>
            <div style={{ fontFamily: F.display, fontSize: 19, fontWeight: 600, color: C.textPrimary, lineHeight: 1.2, marginBottom: 8 }}>
              {reservation.name || "—"}
            </div>
            <CancelledBadge />
          </div>
          <button onClick={onClose}
            style={{
              width: 30, height: 30, borderRadius: "50%", background: "transparent",
              border: `1px solid ${C.borderDefault}`, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              flexShrink: 0, transition: "border-color 0.18s", padding: 0,
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.gold; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.borderDefault; }}
          >
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke={C.textSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="modal-scroll-body">
          <div className="modal-layout-grid">
            
            {/* Left Column: Core Data cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              
              {/* Reservation Details Card */}
              <div style={{
                background: C.surfaceInput,
                border: `1px solid ${C.borderDefault}`,
                borderRadius: 12,
                padding: "16px 18px",
              }}>
                <SectionLabel style={{ marginTop: 0, marginBottom: 12 }}>Reservation Details</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px 20px" }}>
                  {resRows.filter(([label]) => label !== "Setup Requirements").map(([label, value]) => (
                    <div key={label} style={{
                      display: "flex", flexDirection: "column", gap: 4,
                      padding: "6px 0",
                      borderBottom: `1px solid ${C.divider}`,
                    }}>
                      <span style={{ fontFamily: F.label, fontSize: 8, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>{label}</span>
                      <span style={{ fontFamily: F.body, fontSize: 12.5, color: label === "Reference" ? C.gold : C.textPrimary, fontWeight: label === "Reference" ? 700 : 500, lineHeight: 1.4 }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Setup Requirements (Full Width below details grid if present) */}
                {(reservation.setup_requirements || reservation.setupRequirements) ? (
                  <div style={{
                    display: "flex", flexDirection: "column", gap: 4,
                    padding: "10px 0 0",
                    marginTop: 12,
                    borderTop: `1.5px dashed ${C.divider}`,
                  }}>
                    <span style={{ fontFamily: F.label, fontSize: 8, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>Setup Requirements</span>
                    <div style={{
                      fontFamily: F.body, fontSize: 12, color: C.textSecondary, lineHeight: 1.55,
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
                <SectionLabel style={{ marginTop: 0, marginBottom: 12 }}>Guest Information</SectionLabel>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "10px 20px" }}>
                  {guestRows.filter(([label]) => label !== "Special Requests").map(([label, value]) => (
                    <div key={label} style={{
                      display: "flex", flexDirection: "column", gap: 4,
                      padding: "6px 0",
                      borderBottom: `1px solid ${C.divider}`,
                    }}>
                      <span style={{ fontFamily: F.label, fontSize: 8, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>{label}</span>
                      <span style={{ fontFamily: F.body, fontSize: 12.5, color: C.textPrimary, fontWeight: 500, lineHeight: 1.4 }}>{value}</span>
                    </div>
                  ))}
                </div>

                {/* Special Requests (Full Width below) */}
                <div style={{
                  display: "flex", flexDirection: "column", gap: 4,
                  padding: "10px 0 0",
                  marginTop: 12,
                  borderTop: `1.5px dashed ${C.divider}`,
                }}>
                  <span style={{ fontFamily: F.label, fontSize: 8, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>Special Requests</span>
                  <div style={{
                    fontFamily: F.body, fontSize: 12, color: reservation.special_requests ? C.textPrimary : C.textTertiary, lineHeight: 1.55,
                    background: C.surfaceBase, padding: "10px 12px", borderRadius: 8, border: `1px solid ${C.borderDefault}`,
                    fontStyle: reservation.special_requests ? "normal" : "italic"
                  }}>
                    {reservation.special_requests || "None specified"}
                  </div>
                </div>
              </div>

            </div>

            {/* Right Column: Actions / Info Sidebar */}
            <aside style={{ position: "sticky", top: 0, display: "flex", flexDirection: "column", gap: 16 }}>
              
              {/* Cancellation Reason Card */}
              <div style={{
                padding: "14px 16px", borderRadius: 12,
                background: C.accentFaint,
                border: `1px solid ${C.accentBorder}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: 5,
                    background: `${C.accent}15`,
                    border: `1px solid ${C.accentBorder}`,
                    display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                  }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <div style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase", color: C.accent, fontWeight: 700 }}>
                    {isCancelledByGuest ? "Guest's Reason" : "Admin's Reason"}
                  </div>
                </div>
                <div style={{ fontFamily: F.body, fontSize: 12.5, color: C.textPrimary, lineHeight: 1.6, paddingLeft: 2 }}>
                  {reservation.cancellation_reason || <span style={{ color: C.textSecondary, fontStyle: "italic" }}>No reason provided</span>}
                </div>
                {reservation.cancelled_at && (
                  <div style={{
                    marginTop: 10, paddingTop: 10,
                    borderTop: `1px solid ${C.accentBorder}`,
                    fontFamily: F.label, fontSize: 8.5, letterSpacing: "0.10em",
                    textTransform: "uppercase", color: C.textTertiary, fontWeight: 800,
                  }}>
                    Cancelled on: <span style={{ color: C.textSecondary, fontWeight: 600 }}>{fmtDateTime(reservation.cancelled_at)}</span>
                  </div>
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
                <span style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary, display: "block", marginBottom: 10 }}>
                  Reservation Activity & Audit Trail
                </span>
                {renderActivityTimeline()}
              </div>

              {/* Disclaimer */}
              <div style={{
                padding: "10px 14px", borderRadius: 8,
                background: C.accentFaint,
                border: `1px solid ${C.accentBorder}`,
                fontFamily: F.body, fontSize: 11.5, color: C.textSecondary, lineHeight: 1.55,
              }}>
                This reservation was <strong style={{ color: C.textPrimary }}>cancelled by {isCancelledByGuest ? "the guest" : `admin (${cancelledBy})`}</strong> and cannot be modified. Contact the guest directly if you need to reinstate this booking.
              </div>

            </aside>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 4500); return () => clearTimeout(t); }, [onClose]);
  const isSuccess = type === "success";
  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24, zIndex: 9999,
      display: "flex", alignItems: "center", gap: 10,
      padding: "12px 18px",
      background: C.surfaceBase,
      border: `1px solid ${isSuccess ? C.greenBorder : C.accentBorder}`,
      borderRadius: 10,
      boxShadow: "0 8px 28px rgba(0,0,0,0.12)",
      fontFamily: F.body, fontSize: 13,
      animation: "fadeUp 0.22s ease",
      maxWidth: 400,
    }}>
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: isSuccess ? C.green : C.accent, flexShrink: 0 }} />
      <span style={{ color: C.textPrimary, flex: 1, lineHeight: 1.5 }}>{message}</span>
      <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer", padding: 0, color: C.textSecondary }}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────

export default function CancelledDashboard() {
  const { isDark } = useAdminTheme();
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [filteredReservations, setFilteredReservations] = useState([]);
  const [search, setSearch] = useState("");
  const [selectedReservation, setSelectedReservation] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 960);
  const [toast, setToast] = useState(null);
  const [pagination, setPagination] = useState({ currentPage: 1, lastPage: 1, totalItems: 0 });
  const [loading, setLoading] = useState(true);
  const [searchFocused, setSearchFocused] = useState(false);
  const [stats, setStats] = useState({ total: 0, today: 0, thisWeek: 0, missingReason: 0, upcoming: 0 });
  const [reasonFilter, setReasonFilter] = useState("ALL");
  const [sortBy, setSortBy] = useState("cancelled_desc");
  const [venues, setVenues] = useState([]);
  const [roomFilter, setRoomFilter] = useState("ALL");

  const [windowWidth, setWindowWidth] = useState(window.innerWidth);
  useEffect(() => {
    const h = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth <= 960) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);

  const isMobile = windowWidth < 640;
  const isTablet = windowWidth < 960;

  // ── Load cancelled reservations ───────────────────────────────────────────
  const loadReservations = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/reservations?status=cancelled&per_page=500`, {
        headers: { Accept: "application/json" },
      });
      const data = await res.json();
      const list = Array.isArray(data) ? data :
        Array.isArray(data.data) ? data.data :
        Array.isArray(data.reservations) ? data.reservations : [];

      const cancelled = list.filter((r) => {
        const status = (r.status || "").toLowerCase();
        const hasCancellationMeta = Boolean(r.cancelled_at || r.cancellation_reason);
        return ["cancelled", "canceled"].includes(status) || (status === "rejected" && hasCancellationMeta);
      });
      setReservations(cancelled);

      const now = new Date();
      const todayStr = now.toISOString().split("T")[0];
      const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
      const todayCount = cancelled.filter(r => {
        if (!r.cancelled_at) return false;
        return new Date(r.cancelled_at).toISOString().split("T")[0] === todayStr;
      }).length;
      const weekCount = cancelled.filter(r => {
        if (!r.cancelled_at) return false;
        return new Date(r.cancelled_at) >= weekAgo;
      }).length;
      const missingReason = cancelled.filter(r => !r.cancellation_reason).length;
      const upcoming = cancelled.filter(r => {
        if (!r.event_date) return false;
        return new Date(`${r.event_date}T00:00:00`) >= new Date(now.toISOString().split("T")[0] + "T00:00:00");
      }).length;
      setStats({ total: cancelled.length, today: todayCount, thisWeek: weekCount, missingReason, upcoming });
    } catch (e) {
      console.error("[CancelledDashboard] Failed to load:", e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => { loadReservations(); }, []);

  useEffect(() => {
    venueAPI.getAll()
      .then(data => {
        setVenues(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error("[CancelledDashboard] Failed to load venues:", err));
  }, []);

  // WebSocket with polling fallback
  useEffect(() => {
    const wsHost = import.meta.env.VITE_WS_HOST || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'localhost' : window.location.hostname);
    const wsPort = import.meta.env.VITE_WS_PORT || "6001";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${wsHost}:${wsPort}`;

    let ws = null;
    let retryCount = 0;
    const maxRetries = 5;
    const retryDelay = 2000;
    let pollingInterval = null;
    let isPolling = false;
    let reconnectTimer = null;
    let recoveryTimer = null;
    let isMounted = true;

    const startPolling = () => {
      if (isPolling) return;
      isPolling = true;
      pollingInterval = setInterval(async () => {
        try {
          await loadReservations(true);
        } catch (err) { console.error("[CancelledDashboard] Polling error:", err); }
      }, 5000);
    };

    const stopPolling = () => {
      if (pollingInterval) { clearInterval(pollingInterval); pollingInterval = null; isPolling = false; }
    };

    const stopRecovery = () => {
      if (recoveryTimer) { clearInterval(recoveryTimer); recoveryTimer = null; }
    };

    const connect = () => {
      if (!isMounted) return;
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

      try {
        ws = new WebSocket(wsUrl);
        ws.onopen = () => {
          retryCount = 0;
          stopPolling();
          stopRecovery();
          console.log("[CancelledDashboard] WebSocket connected successfully");
        };
        ws.onclose = () => {
          ws = null;
          if (!isMounted) return;

          if (retryCount >= maxRetries) {
            startPolling();
            if (!recoveryTimer) {
              recoveryTimer = setInterval(() => {
                if (!ws && isMounted) {
                  console.log("[CancelledDashboard] Attempting to recover WebSocket connection...");
                  connect();
                }
              }, 45000);
            }
            return;
          }

          retryCount++;
          const delay = Math.min(retryDelay * Math.pow(2, retryCount - 1), 30000);
          console.log(`[CancelledDashboard] WebSocket disconnected. Retrying in ${delay}ms (attempt ${retryCount}/${maxRetries})`);
          reconnectTimer = setTimeout(connect, delay);
        };
        ws.onerror = () => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.close();
          }
        };
        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            if (msg.type === "reservation_cancelled") {
              setReservations(prev => {
                const idx = prev.findIndex(r => r.id === msg.data.id);
                if (idx >= 0) { const arr = [...prev]; arr[idx] = msg.data; return arr; }
                return [...prev, msg.data];
              });
            }
          } catch (err) { console.error("[CancelledDashboard] WS message error:", err); }
        };
      } catch (err) { console.error("[CancelledDashboard] WS init failed:", err); startPolling(); }
    };

    connect();
    return () => {
      isMounted = false;
      stopPolling();
      stopRecovery();
      if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
      if (ws) { ws.close(); ws = null; }
    };
  }, []);

  // Filter
  useEffect(() => {
    let filtered = [...reservations];
    if (reasonFilter === "WITH_REASON") {
      filtered = filtered.filter(r => Boolean(r.cancellation_reason));
    }
    if (reasonFilter === "NO_REASON") {
      filtered = filtered.filter(r => !r.cancellation_reason);
    }
    if (roomFilter !== "ALL") {
      const children = resolveOutletChildren(roomFilter, venues);
      const childrenSet = new Set(children.map(c => c.toLowerCase().trim()));
      filtered = filtered.filter(r => {
        const resRoom = String(r.room || r.venue?.name || "").toLowerCase().trim();
        const targetRoom = roomFilter.toLowerCase().trim();
        return resRoom === targetRoom || childrenSet.has(resRoom);
      });
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter(r =>
        r.name?.toLowerCase().includes(q) ||
        r.email?.toLowerCase().includes(q) ||
        r.phone?.toLowerCase().includes(q) ||
        r.room?.toLowerCase().includes(q) ||
        r.reference_code?.toLowerCase().includes(q) ||
        r.cancellation_reason?.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => {
      const cancelledTime = (r) => r.cancelled_at ? new Date(r.cancelled_at).getTime() : 0;
      const eventTime = (r) => r.event_date ? new Date(`${r.event_date}T00:00:00`).getTime() : 0;
      if (sortBy === "cancelled_asc") return cancelledTime(a) - cancelledTime(b);
      if (sortBy === "event_asc") return eventTime(a) - eventTime(b);
      if (sortBy === "event_desc") return eventTime(b) - eventTime(a);
      if (sortBy === "guest_az") return String(a.name || "").localeCompare(String(b.name || ""));
      return cancelledTime(b) - cancelledTime(a);
    });
    setFilteredReservations(filtered);
    setPagination(p => ({ ...p, lastPage: Math.ceil(filtered.length / 10) || 1, totalItems: filtered.length, currentPage: 1 }));
  }, [reservations, search, reasonFilter, sortBy]);

  const handlePageChange = (page) => {
    if (page < 1 || page > pagination.lastPage) return;
    setPagination(p => ({ ...p, currentPage: page }));
  };

  const getPageNumbers = () => {
    const { currentPage, lastPage } = pagination;
    if (lastPage <= 5) return Array.from({ length: lastPage }, (_, i) => i + 1);
    const start = Math.max(1, currentPage - 1);
    const end = Math.min(lastPage, currentPage + 1);
    const pages = [];
    if (start > 1) { pages.push(1); if (start > 2) pages.push("..."); }
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < lastPage) { if (end < lastPage - 1) pages.push("..."); pages.push(lastPage); }
    return pages;
  };

  const fmtDate = (d) => {
    if (!d) return "—";
    try { return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }); }
    catch { return d; }
  };
  const fmtDateTime = (dt) => {
    if (!dt) return "—";
    try {
      return new Date(dt).toLocaleDateString("en-US", {
        month: "short", day: "numeric", year: "numeric",
        hour: "numeric", minute: "2-digit",
      });
    } catch { return dt; }
  };

  const pagedReservations = filteredReservations.slice(
    (pagination.currentPage - 1) * 10,
    pagination.currentPage * 10
  );

  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    navigate('/admin');
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes spin    { to { transform: rotate(360deg); } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes modalIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        @keyframes shimmer { 0% { background-position: -200% 0 } 100% { background-position: 200% 0 } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 4px; }
        
        .admin-page-content-container {
          padding: 30px 32px 42px;
          animation: fadeUp 0.28s ease;
        }
        .cancelled-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 10px;
          flex-wrap: nowrap;
          width: 100%;
        }
        .cancelled-card-badges {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          justify-content: flex-end;
          gap: 7px;
          flex-shrink: 0;
        }
        @media (max-width: 960px) {
          .admin-page-content-container {
            padding: 16px 12px 24px !important;
          }
          .cancelled-card-header {
            flex-wrap: wrap !important;
          }
          .cancelled-card-header > div:first-child {
            width: 100% !important;
            flex: none !important;
            padding-left: 0 !important;
          }
          .cancelled-card-badges {
            flex-direction: row !important;
            align-items: center !important;
            justify-content: flex-start !important;
            width: 100% !important;
            border-top: 1px solid ${C.divider} !important;
            padding-top: 10px !important;
            margin-top: 8px !important;
            flex-wrap: wrap !important;
            gap: 6px 8px !important;
          }
        }
      `}</style>

      <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: F.body, background: C.pageBg, color: C.textPrimary }}>
        <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} activeNav="cancelled" />

        <div style={{ display: "flex", flexDirection: "column", height: "100vh", flex: 1, minWidth: 0, background: C.pageBg, overflow: "hidden" }}>
          <AdminNavbar />

          <div style={{ flex: 1, minWidth: 0, overflow: "auto" }}>

            {/* Top bar */}
            <div style={{
              position: "sticky", top: 0, zIndex: 100,
              background: C.navBg,
              backdropFilter: "blur(20px)", WebkitBackdropFilter: "blur(20px)",
              borderBottom: `1px solid ${C.navBorder}`,
              padding: isMobile ? "10px 16px" : "0 28px",
              height: isMobile ? "auto" : 52,
              display: "none", alignItems: "center",
              justifyContent: "space-between",
              gap: 10, flexWrap: isMobile ? "wrap" : "nowrap",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.20em", color: C.gold, fontWeight: 700, textTransform: "uppercase" }}>Admin</span>
                <span style={{ color: C.textTertiary, fontSize: 11 }}>·</span>
                <span style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.14em", color: C.textSecondary, fontWeight: 600, textTransform: "uppercase" }}>Cancelled Reservations</span>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  onClick={loadReservations}
                  disabled={loading}
                  title="Refresh"
                  style={{
                    width: 32, height: 32, borderRadius: 7,
                    background: "transparent",
                    border: `1px solid ${C.borderDefault}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: loading ? "not-allowed" : "pointer",
                    transition: "border-color 0.18s", flexShrink: 0,
                  }}
                  onMouseEnter={(e) => { if (!loading) e.currentTarget.style.borderColor = C.borderAccent; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.borderDefault; }}
                >
                  {loading
                    ? <Spinner size={12} />
                    : (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.textSecondary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/>
                        <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                      </svg>
                    )
                  }
                </button>

                <div style={{ position: "relative", display: "none" }}>
                  <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                    width="12" height="12" viewBox="0 0 24 24" fill="none"
                    stroke={searchFocused ? C.accent : C.textTertiary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                  <input
                    style={{
                      padding: "7px 12px 7px 28px",
                      background: C.surfaceInput,
                      border: `1.5px solid ${searchFocused ? C.accentBorder : C.borderDefault}`,
                      borderRadius: 8, color: C.textPrimary,
                      fontFamily: F.body, fontSize: 12,
                      width: isMobile ? "100%" : 240, outline: "none",
                      transition: "border-color 0.18s,box-shadow 0.18s",
                      boxShadow: searchFocused ? C.inputFocusShadow : "none",
                    }}
                    placeholder="Search name, email, ref, reason…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    onFocus={() => setSearchFocused(true)}
                    onBlur={() => setSearchFocused(false)}
                  />
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="admin-page-content-container">

              <AdminPageHeader
                eyebrow="Cancellation Review"
                title="Cancelled Reservations"
                description="Review guest-cancelled reservations, cancellation reasons, and records that may need follow-up."
                C={C}
                F={F}
                compact={isMobile || isTablet}
              />

              {/* Heading */}
              <div style={{ display: "none", marginBottom: isMobile ? 18 : 22 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ display: "inline-block", width: 22, height: "1px", background: C.gold, opacity: 0.5 }} />
                  <span style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.26em", color: C.gold, fontWeight: 700, textTransform: "uppercase" }}>Dashboard</span>
                </div>
                <h1 style={{ fontFamily: F.display, fontSize: isMobile ? 22 : isTablet ? 28 : 34, fontWeight: 700, color: C.textPrimary, lineHeight: 1.15, margin: "0 0 6px" }}>
                  Cancelled Reservations
                </h1>
                <p style={{ fontFamily: F.body, fontSize: 13, color: C.textSecondary, margin: 0, lineHeight: 1.65 }}>
                  Reservations cancelled by guests — review cancellation reasons below
                </p>
              </div>

              {/* Review summary */}
              <div style={{
                background: C.cardBg,
                border: `1px solid ${C.cardBorder}`,
                borderRadius: 12,
                padding: isMobile ? "12px" : "14px 16px",
                marginBottom: isMobile ? 16 : 18,
                boxShadow: "0 1px 4px rgba(24,20,14,0.025)",
                display: "grid",
                gap: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: C.gold, marginBottom: 4 }}>
                      Cancellation Review
                    </div>
                    <div style={{ fontSize: 12, color: C.textSecondary }}>
                      Track guest-cancelled reservations and review cancellation reasons.
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                    <InlineMetric label="This Week" value={loading ? "--" : stats.thisWeek} tone="slate" />
                    <InlineMetric label="Upcoming" value={loading ? "--" : stats.upcoming} tone="gold" />
                    <InlineMetric label="No Reason" value={loading ? "--" : stats.missingReason} tone="slate" />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : isTablet ? "repeat(2,1fr)" : "repeat(3,minmax(0,1fr))", gap: 10 }}>
                  <ReviewMetric label="Total Cancelled" value={loading ? "--" : stats.total} helper="guest cancellations" tone="slate" active={reasonFilter === "ALL"} onClick={() => setReasonFilter("ALL")} isMobile={isMobile} />
                  <ReviewMetric label="Cancelled Today" value={loading ? "--" : stats.today} helper="new reviews" tone="gold" isMobile={isMobile} />
                  <ReviewMetric label="Missing Reason" value={loading ? "--" : stats.missingReason} helper="needs follow-up" tone="slate" active={reasonFilter === "NO_REASON"} onClick={() => setReasonFilter("NO_REASON")} isMobile={isMobile} style={{ gridColumn: isMobile ? "span 2" : "auto" }} />
                </div>
              </div>

              <div style={{
                display: "none",
                gridTemplateColumns: isMobile ? "repeat(2,1fr)" : "repeat(3,1fr)",
                gap: isMobile ? 10 : 12,
                marginBottom: isMobile ? 18 : 22,
              }}>
                {[].map(({ label, count }) => (
                  <div key={label} style={{
                    background: C.cardBg,
                    border: `1px solid ${C.cardBorder}`,
                    borderRadius: 10,
                    padding: isMobile ? "14px 12px" : "18px 20px",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.05)",
                    position: "relative", overflow: "hidden",
                  }}>
                    <div style={{
                      position: "absolute", top: 0, left: 0, right: 0, height: 2,
                      background: `linear-gradient(90deg, transparent 0%, ${C.accent}50 50%, transparent 100%)`,
                    }} />
                    <div style={{
                      fontFamily: F.display,
                      fontSize: isMobile ? 28 : 36,
                      fontWeight: 700,
                      color: C.textPrimary,
                      lineHeight: 1, marginBottom: isMobile ? 6 : 8,
                      letterSpacing: "-0.02em",
                    }}>
                      {loading ? "—" : count}
                    </div>
                    <div style={{ fontFamily: F.label, fontSize: 9, color: C.textTertiary, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.14em" }}>
                      {label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Table card */}
              <div style={{ background: C.cardBg, borderRadius: 12, border: `1px solid ${C.cardBorder}`, overflow: "visible", boxShadow: "0 1px 4px rgba(24,20,14,0.03)" }}>

                {/* Card header */}
                <div style={{
                  padding: isMobile ? "12px 14px" : "14px 22px",
                  borderBottom: `1px solid ${C.divider}`,
                  display: "flex", alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: isMobile ? "wrap" : "nowrap",
                  gap: 10,
                  background: C.headerGradient,
                  borderTopLeftRadius: 11,
                  borderTopRightRadius: 11,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ fontFamily: F.label, fontSize: 9, letterSpacing: "0.20em", color: C.textSecondary, fontWeight: 700, textTransform: "uppercase" }}>Cancelled</div>
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      padding: "2px 8px",
                      background: C.accentFaint,
                      border: `1px solid ${C.accentBorder}`,
                      borderRadius: 20,
                      fontFamily: F.label, fontSize: 9, fontWeight: 700, color: C.accent, letterSpacing: "0.10em",
                    }}>
                      {loading ? "—" : filteredReservations.length}
                    </span>
                  </div>

                  {pagination.lastPage > 1 && (
                    <div style={{ display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" }}>
                      <button onClick={() => handlePageChange(pagination.currentPage - 1)} disabled={pagination.currentPage <= 1}
                        style={{ width: 29, height: 29, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.borderDefault}`, borderRadius: 6, background: "transparent", color: pagination.currentPage <= 1 ? C.textTertiary : C.textSecondary, cursor: pagination.currentPage <= 1 ? "not-allowed" : "pointer", fontSize: 14, transition: "all 0.15s" }}
                      >‹</button>
                      {getPageNumbers().map((p, idx) =>
                        p === "..." ? (
                          <span key={`e-${idx}`} style={{ width: 29, height: 29, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: C.textTertiary }}>…</span>
                        ) : (
                          <button key={p} onClick={() => handlePageChange(p)}
                            style={{ width: 29, height: 29, display: "flex", alignItems: "center", justifyContent: "center", border: pagination.currentPage === p ? `1px solid ${C.accent}` : `1px solid ${C.borderDefault}`, borderRadius: 6, background: pagination.currentPage === p ? C.accent : "transparent", color: pagination.currentPage === p ? "#fff" : C.textSecondary, cursor: "pointer", fontSize: 11, fontWeight: pagination.currentPage === p ? 700 : 400, fontFamily: F.label, transition: "all 0.15s" }}
                          >{p}</button>
                        )
                      )}
                      <button onClick={() => handlePageChange(pagination.currentPage + 1)} disabled={pagination.currentPage >= pagination.lastPage}
                        style={{ width: 29, height: 29, display: "flex", alignItems: "center", justifyContent: "center", border: `1px solid ${C.borderDefault}`, borderRadius: 6, background: "transparent", color: pagination.currentPage >= pagination.lastPage ? C.textTertiary : C.textSecondary, cursor: pagination.currentPage >= pagination.lastPage ? "not-allowed" : "pointer", fontSize: 14, transition: "all 0.15s" }}
                      >›</button>
                    </div>
                  )}
                </div>

                <div style={{ padding: isMobile ? "12px 14px" : "14px 22px", borderBottom: `1px solid ${C.divider}`, background: C.surfaceBase, display: "grid", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {[
                      ["ALL", "All"],
                      ["WITH_REASON", "With Reason"],
                      ["NO_REASON", "No Reason"],
                    ].map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setReasonFilter(value)}
                        style={{
                          padding: "6px 10px",
                          borderRadius: 999,
                          border: `1px solid ${reasonFilter === value ? C.accentBorder : C.borderDefault}`,
                          background: reasonFilter === value ? C.accentFaint : C.surfaceBase,
                          color: reasonFilter === value ? C.accent : C.textSecondary,
                          fontFamily: F.label,
                          fontSize: 9,
                          fontWeight: 800,
                          letterSpacing: "0.11em",
                          textTransform: "uppercase",
                          cursor: "pointer",
                        }}
                      >
                        {label}
                      </button>
                    ))}

                    <div style={{ position: "relative", marginLeft: isMobile ? 0 : "auto", flex: isMobile ? "1 1 100%" : "1 1 280px", maxWidth: isMobile ? "100%" : 380 }}>
                      <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
                        width="12" height="12" viewBox="0 0 24 24" fill="none"
                        stroke={searchFocused ? C.accent : C.textTertiary} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                      </svg>
                      <input
                        style={{
                          padding: "8px 12px 8px 30px",
                          background: C.surfaceInput,
                          border: `1px solid ${searchFocused ? C.accentBorder : C.borderDefault}`,
                          borderRadius: 8,
                          color: C.textPrimary,
                          fontFamily: F.body,
                          fontSize: 12,
                          width: "100%",
                          outline: "none",
                          transition: "border-color 0.18s,box-shadow 0.18s",
                          boxShadow: searchFocused ? C.inputFocusShadow : "none",
                        }}
                        placeholder="Search guest, contact, room, reference, or reason"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onFocus={() => setSearchFocused(true)}
                        onBlur={() => setSearchFocused(false)}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "minmax(140px,200px) minmax(140px,200px) minmax(120px,160px) auto", gap: 10, alignItems: "end" }}>
                    <label style={{ display: "grid", gap: 5 }}>
                      <span style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>Room / Outlet</span>
                      <RoomFilterDropdown
                        rooms={[]} 
                        venues={venues}
                        selectedRoom={roomFilter}
                        onSelect={(r) => setRoomFilter(r)}
                        isMobile={isMobile}
                      />
                    </label>
                    <label style={{ display: "grid", gap: 5 }}>
                      <span style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.textTertiary }}>Sort</span>
                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={{ padding: "8px 10px", height: 36, boxSizing: "border-box", border: `1px solid ${C.borderDefault}`, borderRadius: 8, background: C.surfaceInput, color: C.textPrimary, fontSize: 12 }}>
                        <option value="cancelled_desc">Latest cancelled</option>
                        <option value="cancelled_asc">Oldest cancelled</option>
                        <option value="event_asc">Event soonest</option>
                        <option value="event_latest">Event latest</option>
                        <option value="guest_az">Guest A-Z</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      onClick={() => { setReasonFilter("ALL"); setSearch(""); setSortBy("cancelled_desc"); setRoomFilter("ALL"); }}
                      style={{ gridColumn: isMobile ? "span 2" : "auto", height: 36, boxSizing: "border-box", border: `1px solid ${C.borderDefault}`, borderRadius: 8, background: C.surfaceBase, color: C.textSecondary, fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      Reset Review
                    </button>
                    <div style={{ gridColumn: isMobile ? "span 2" : "auto", fontFamily: F.body, fontSize: 11.5, color: C.textSecondary, lineHeight: 1.5 }}>
                      Cancelled records are read-only and kept for customer-service review.
                    </div>
                  </div>
                </div>

                {/* List */}
                <div style={{ padding: isMobile ? "10px" : "12px 18px", display: "flex", flexDirection: "column", gap: 8 }}>
                  {loading ? (
                    Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} style={{ height: 90, borderRadius: 8, background: "linear-gradient(90deg,#F0EDE6 25%,#E8E4DC 50%,#F0EDE6 75%)", backgroundSize: "200% 100%", animation: `shimmer 1.4s ease infinite`, animationDelay: `${i * 0.08}s`, border: `1px solid rgba(0,0,0,0.04)` }} />
                    ))
                  ) : pagedReservations.length === 0 ? (
                    <div style={{ padding: "60px 24px", textAlign: "center" }}>
                      <div style={{
                        width: 48, height: 48, borderRadius: 12,
                        background: C.accentFaint, border: `1px solid ${C.accentBorder}`,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        margin: "0 auto 14px",
                      }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
                        </svg>
                      </div>
                      <div style={{ fontFamily: F.label, fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", color: C.textSecondary, textTransform: "uppercase" }}>
                        {search ? "No Results Found" : "No Cancelled Reservations"}
                      </div>
                      <div style={{ fontFamily: F.body, fontSize: 12, color: C.textTertiary, marginTop: 6 }}>
                        {search ? "Try adjusting your search" : "There are no guest-cancelled reservations yet"}
                      </div>
                    </div>
                  ) : (
                    pagedReservations.map((reservation, idx) => (
                      <div
                        key={reservation.id || idx}
                        onClick={() => { setSelectedReservation(reservation); setShowModal(true); }}
                        style={{
                          background: C.surfaceBase,
                          border: `1px solid ${C.borderDefault}`,
                          borderRadius: 8,
                          padding: isMobile ? "12px" : "14px 18px",
                          cursor: "pointer",
                          transition: "all 0.16s ease",
                          animation: `fadeUp 0.22s ease both`,
                          animationDelay: `${idx * 0.025}s`,
                          position: "relative", overflow: "hidden",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accentBorder; e.currentTarget.style.boxShadow = `0 3px 12px rgba(107,114,128,0.10)`; e.currentTarget.style.transform = "translateY(-1px)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.borderDefault; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.transform = "translateY(0)"; }}
                      >
                        {/* Left accent strip */}
                        <div style={{ position: "absolute", top: 0, left: 0, bottom: 0, width: 3, background: C.accent, opacity: 0.25, borderRadius: "0 2px 2px 0" }} />

                        <div className="cancelled-card-header">
                          <div style={{ flex: 1, minWidth: 0, paddingLeft: 10 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                              <div style={{ fontFamily: F.body, fontSize: 14, fontWeight: 600, color: C.textPrimary }}>{reservation.name || "—"}</div>
                              {reservation.reference_code && (
                                <span style={{ fontFamily: F.mono, fontSize: 10, fontWeight: 600, letterSpacing: "0.08em", color: C.gold, padding: "2px 6px", background: C.goldFaint, border: `1px solid rgba(140,107,42,0.15)`, borderRadius: 4, flexShrink: 0 }}>
                                  {reservation.reference_code}
                                </span>
                              )}
                            </div>
                            <div style={{ fontFamily: F.body, fontSize: 12, color: C.textSecondary, marginBottom: 6, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                              <span>{reservation.email || "—"}</span>
                              {reservation.phone && <><span style={{ color: C.textTertiary }}>·</span><span>{reservation.phone}</span></>}
                            </div>

                            {/* Cancellation reason preview */}
                            {reservation.cancellation_reason && (
                              <div style={{
                                display: "flex", alignItems: "flex-start", gap: 6,
                                padding: "7px 10px", borderRadius: 6,
                                background: C.accentFaint, border: `1px solid ${C.accentBorder}`,
                                marginBottom: 6,
                              }}>
                                <svg style={{ flexShrink: 0, marginTop: 1 }} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.accent} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
                                </svg>
                                <span style={{
                                  fontFamily: F.body, fontSize: 11.5, color: C.textSecondary,
                                  lineHeight: 1.5,
                                  display: "-webkit-box", WebkitLineClamp: 2,
                                  WebkitBoxOrient: "vertical", overflow: "hidden",
                                }}>
                                  {reservation.cancellation_reason}
                                </span>
                              </div>
                            )}

                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                              {reservation.event_date && (
                                <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: C.textTertiary, padding: "2px 6px", background: "rgba(0,0,0,0.04)", border: `1px solid rgba(0,0,0,0.06)`, borderRadius: 4 }}>
                                  Event: {fmtDate(reservation.event_date)}
                                </span>
                              )}
                              {reservation.cancelled_at && (
                                <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: C.accent, opacity: 0.8, padding: "2px 6px", background: C.accentFaint, border: `1px solid ${C.accentBorder}`, borderRadius: 4 }}>
                                  Cancelled: {fmtDateTime(reservation.cancelled_at)}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="cancelled-card-badges">
                            <CancelledBadge />
                            <div style={{ display: "flex", alignItems: "center", gap: 3, fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", color: C.textTertiary }}>
                              View
                              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6" /></svg>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Footer */}
                {!loading && filteredReservations.length > 0 && (
                  <div style={{ padding: "10px 18px", borderTop: `1px solid ${C.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8, borderBottomLeftRadius: 11, borderBottomRightRadius: 11 }}>
                    <div style={{ fontFamily: F.body, fontSize: 11, color: C.textTertiary }}>
                      Showing <strong style={{ color: C.textSecondary }}>{(pagination.currentPage - 1) * 10 + 1}–{Math.min(pagination.currentPage * 10, filteredReservations.length)}</strong> of <strong style={{ color: C.textSecondary }}>{filteredReservations.length}</strong> cancelled reservations
                    </div>
                    {search && (
                      <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: C.textTertiary }}>
                        Search: <span style={{ color: C.accent }}>{search}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

        {showModal && selectedReservation && (
          <DetailModal
            reservation={selectedReservation}
            onClose={() => { setShowModal(false); setSelectedReservation(null); }}
          />
        )}
      </div>
    </>
  );
}
