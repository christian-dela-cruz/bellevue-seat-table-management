import React from "react";

export const DEFAULT_EVENT_TIME = "19:00";
const STORAGE_KEY = "seatmap:selected_schedule";

export function loadSeatmapSchedule() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveSeatmapSchedule(schedule = {}) {
  const normalized = {
    eventDate: schedule.eventDate || "",
    eventTime: schedule.eventTime || DEFAULT_EVENT_TIME,
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    window.dispatchEvent(new CustomEvent("seatmap:schedule-changed", { detail: normalized }));
    window.dispatchEvent(new CustomEvent("seatmap:saved", { detail: { schedule: normalized } }));
  } catch {}

  return normalized;
}

export function normalizeSchedule(schedule = {}) {
  const stored = loadSeatmapSchedule();
  return {
    eventDate: schedule.eventDate || stored.eventDate || "",
    eventTime: schedule.eventTime || stored.eventTime || DEFAULT_EVENT_TIME,
  };
}

export function seatmapScheduleQuery(schedule = {}) {
  const normalized = normalizeSchedule(schedule);
  const params = new URLSearchParams();

  if (normalized.eventDate) params.set("event_date", normalized.eventDate);
  if (normalized.eventTime) params.set("event_time", normalized.eventTime.substring(0, 5));

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function withSeatmapSchedule(url, schedule = {}) {
  const query = seatmapScheduleQuery(schedule);
  if (!query) return url;

  return `${url}${url.includes("?") ? `&${query.slice(1)}` : query}`;
}

export default function ScheduleGate({ schedule, onChange, roomLabel = "this room", isDark = false }) {
  const normalized = normalizeSchedule(schedule);
  const isReady = Boolean(normalized.eventDate && normalized.eventTime);
  const [draftSchedule, setDraftSchedule] = React.useState(normalized);
  const isDraftValid = Boolean(draftSchedule.eventDate && draftSchedule.eventTime);
  const hasChanges =
    draftSchedule.eventDate !== normalized.eventDate ||
    draftSchedule.eventTime !== normalized.eventTime;

  React.useEffect(() => {
    setDraftSchedule(normalized);
  }, [normalized.eventDate, normalized.eventTime]);

  const confirmSchedule = () => {
    if (!isDraftValid) return;
    onChange(saveSeatmapSchedule(draftSchedule));
  };

  if (isReady) {
    return (
      <div style={{
        width: "100%",
        display: "grid",
        gap: 10,
        padding: "14px 16px",
        borderRadius: 12,
        border: isDark ? "1px solid rgba(212,175,55,0.28)" : "1px solid rgba(140,107,42,0.22)",
        background: isDark ? "rgba(18,16,14,0.94)" : "rgba(255,255,255,0.96)",
        boxShadow: isDark ? "0 4px 20px rgba(0,0,0,0.30)" : "0 2px 12px rgba(0,0,0,0.06)",
        boxSizing: "border-box",
        fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.18em", textTransform: "uppercase", color: "#8C6B2A" }}>
            Availability Schedule
          </span>
          <span style={{
            maxWidth: 130,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            fontSize: 11,
            color: isDark ? "rgba(247,244,238,0.62)" : "rgba(24,20,14,0.52)",
          }}>
            {roomLabel}
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 104px", gap: 8 }}>
          <input
            type="date"
            value={draftSchedule.eventDate}
            onChange={(event) => setDraftSchedule({ ...draftSchedule, eventDate: event.target.value })}
            style={controlStyle(isDark)}
          />
          <input
            type="time"
            value={draftSchedule.eventTime}
            onChange={(event) => setDraftSchedule({ ...draftSchedule, eventTime: event.target.value })}
            style={controlStyle(isDark)}
          />
        </div>
        <button
          type="button"
          onClick={confirmSchedule}
          disabled={!isDraftValid || !hasChanges}
          style={confirmButtonStyle(isDark, isDraftValid && hasChanges)}
        >
          Confirm Schedule
        </button>
      </div>
    );
  }

  return (
    <div style={{
      position: "fixed",
      inset: 0,
      zIndex: 6000,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
      background: "rgba(0,0,0,0.48)",
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
      fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
    }}>
      <div style={{
        width: "100%",
        maxWidth: 420,
        borderRadius: 14,
        overflow: "hidden",
        background: "#FFFFFF",
        border: "1px solid rgba(0,0,0,0.08)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.24)",
      }}>
        <div style={{ height: 2, background: "linear-gradient(90deg, transparent, rgba(140,107,42,0.75), transparent)" }} />
        <div style={{ padding: "20px 22px 18px", background: "linear-gradient(160deg,#FAF8F4 0%,#F2EFE8 100%)", borderBottom: "1px solid rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.22em", color: "#8C6B2A", textTransform: "uppercase", marginBottom: 6 }}>
            Select Schedule First
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#18140E", lineHeight: 1.2 }}>
            Check availability for {roomLabel}
          </div>
        </div>
        <div style={{ padding: "20px 22px 24px" }}>
          <div style={{ fontSize: 12.5, color: "#7A7060", lineHeight: 1.65, marginBottom: 16 }}>
            Seat and table status depends on the reservation date and time. Choose a schedule before selecting a seat/table.
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <label style={labelStyle}>
              Date
              <input
                type="date"
                value={draftSchedule.eventDate}
                onChange={(event) => setDraftSchedule({ ...draftSchedule, eventDate: event.target.value })}
                style={modalInputStyle}
              />
            </label>
            <label style={labelStyle}>
              Time
              <input
                type="time"
                value={draftSchedule.eventTime}
                onChange={(event) => setDraftSchedule({ ...draftSchedule, eventTime: event.target.value })}
                style={modalInputStyle}
              />
            </label>
            <button
              type="button"
              onClick={confirmSchedule}
              disabled={!isDraftValid}
              style={confirmButtonStyle(false, isDraftValid)}
            >
              Confirm Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function controlStyle(isDark) {
  return {
    height: 32,
    border: "1px solid rgba(0,0,0,0.10)",
    borderRadius: 8,
    background: isDark ? "#18140E" : "#FFFFFF",
    color: isDark ? "#F7F4EE" : "#18140E",
    padding: "0 8px",
    fontSize: 12,
    fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
    outline: "none",
  };
}

function confirmButtonStyle(isDark, isActive) {
  return {
    height: 34,
    border: 0,
    borderRadius: 8,
    background: isActive ? "#2E7A5A" : (isDark ? "rgba(247,244,238,0.14)" : "rgba(24,20,14,0.12)"),
    color: isActive ? "#FFFFFF" : (isDark ? "rgba(247,244,238,0.42)" : "rgba(24,20,14,0.38)"),
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
    cursor: isActive ? "pointer" : "not-allowed",
  };
}

const labelStyle = {
  display: "grid",
  gap: 7,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
  color: "rgba(24,20,14,0.48)",
};

const modalInputStyle = {
  height: 40,
  border: "1px solid rgba(0,0,0,0.10)",
  borderRadius: 8,
  background: "#FFFFFF",
  color: "#18140E",
  padding: "0 11px",
  fontSize: 13,
  fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
  outline: "none",
};
