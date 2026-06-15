import React, { useState } from "react";
import { venueAPI } from "../../services/venueAPI";
import BellevueDropdown from "../BellevueDropdown";

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

export default function ScheduleGate({ schedule, onChange, roomLabel = "this room", isDark = false, guests = 1, locked = false }) {
  const normalized = normalizeSchedule(schedule);
  const isReady = Boolean(normalized.eventDate && normalized.eventTime);
  const [draftSchedule, setDraftSchedule] = React.useState(normalized);
  const [slots, setSlots] = React.useState([]);

  if (locked && isReady) {
    const formattedDate = new Date(normalized.eventDate).toLocaleDateString(undefined, {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    
    // Convert 24h eventTime to 12h formatted time
    const timeParts = String(normalized.eventTime).split(':');
    const hr = parseInt(timeParts[0], 10);
    const minStr = timeParts[1] || '00';
    const formattedTime = `${hr % 12 || 12}:${minStr} ${hr >= 12 ? 'PM' : 'AM'}`;

    return (
      <div style={{
        width: "100%",
        display: "grid",
        gap: 8,
        padding: "20px",
        borderRadius: 16,
        border: isDark ? "1.5px solid rgba(196,163,90,0.3)" : "1.5px solid rgba(140,107,42,0.25)",
        background: isDark ? "#111009" : "#FFFFFF",
        boxShadow: isDark ? "0 10px 30px rgba(0,0,0,0.25)" : "0 8px 24px rgba(78,60,32,0.04)",
        boxSizing: "border-box",
        fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`, paddingBottom: 8 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.20em", textTransform: "uppercase", color: isDark ? "#C4A35A" : "#8C6B2A" }}>
            Event Schedule
          </span>
        </div>
        <div style={{ fontSize: 13, color: isDark ? "#EDE8DF" : "#18140E", lineHeight: 1.5, display: "grid", gap: 4 }}>
          <div><strong>Date:</strong> {formattedDate}</div>
          <div><strong>Time:</strong> {formattedTime}</div>
        </div>
      </div>
    );
  }
  const [slotLoading, setSlotLoading] = React.useState(false);
  const [slotError, setSlotError] = React.useState("");
  const [scheduleMessage, setScheduleMessage] = React.useState("");
  const [scheduleEnforced, setScheduleEnforced] = React.useState(false);
  const selectedSlot = slots.find((slot) => slot.time === String(draftSchedule.eventTime || "").substring(0, 5));
  const slotAvailable = slots.length === 0 ? !scheduleEnforced : Boolean(selectedSlot?.available);
  const isDraftValid = Boolean(draftSchedule.eventDate && draftSchedule.eventTime && slotAvailable);
  const hasChanges =
    draftSchedule.eventDate !== normalized.eventDate ||
    draftSchedule.eventTime !== normalized.eventTime;

  React.useEffect(() => {
    setDraftSchedule(normalized);
  }, [normalized.eventDate, normalized.eventTime]);

  React.useEffect(() => {
    if (!draftSchedule.eventDate || !roomLabel) {
      setSlots([]);
      setScheduleMessage("");
      setScheduleEnforced(false);
      return undefined;
    }

    let active = true;
    setSlotLoading(true);
    setSlotError("");

    venueAPI.getTimeSlots({
      room: roomLabel,
      date: draftSchedule.eventDate,
      guests,
    })
      .then((response) => {
        if (!active) return;
        const nextSlots = Array.isArray(response?.slots) ? response.slots : [];
        const enforced = Boolean(response?.schedule_enforced);
        setSlots(nextSlots);
        setScheduleEnforced(enforced);
        setScheduleMessage(response?.message || "");
        if (nextSlots.length > 0 && !nextSlots.some((slot) => slot.time === draftSchedule.eventTime && slot.available)) {
          const firstAvailable = nextSlots.find((slot) => slot.available);
          if (firstAvailable) {
            setDraftSchedule((current) => ({ ...current, eventTime: firstAvailable.time }));
          }
        }
      })
      .catch(() => {
        if (!active) return;
        setSlotError("Unable to load configured time slots. Manual time entry is still available.");
        setSlots([]);
        setScheduleMessage("");
        setScheduleEnforced(false);
      })
      .finally(() => {
        if (active) setSlotLoading(false);
      });

    return () => {
      active = false;
    };
  }, [draftSchedule.eventDate, roomLabel, guests]);

  const confirmSchedule = () => {
    if (!isDraftValid) return;
    onChange(saveSeatmapSchedule(draftSchedule));
  };

  const [dateFocused, setDateFocused] = useState(false);

  if (isReady) {
    return (
      <div style={{
        width: "100%",
        display: "grid",
        gap: 14,
        padding: "22px",
        borderRadius: 16,
        border: isDark ? "1.5px solid rgba(196,163,90,0.22)" : "1.5px solid rgba(140,107,42,0.18)",
        background: isDark ? "#111009" : "#FFFFFF",
        boxShadow: isDark ? "0 10px 30px rgba(0,0,0,0.25)" : "0 8px 24px rgba(78,60,32,0.04)",
        boxSizing: "border-box",
        fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"}`, paddingBottom: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.20em", textTransform: "uppercase", color: isDark ? "#C4A35A" : "#8C6B2A" }}>
            Availability Schedule
          </span>
        </div>
        
        <div style={{ display: "grid", gap: 12 }}>
          <label style={{ ...labelStyle, color: isDark ? "#8A8278" : "rgba(24,20,14,0.48)" }}>
            Date
            <input
              type="date"
              value={draftSchedule.eventDate}
              onFocus={() => setDateFocused(true)}
              onBlur={() => setDateFocused(false)}
              onChange={(event) => setDraftSchedule({ ...draftSchedule, eventDate: event.target.value })}
              style={{
                ...controlStyle(isDark),
                border: dateFocused
                  ? (isDark ? "1.5px solid rgba(196,163,90,0.35)" : "1.5px solid rgba(140,107,42,0.32)")
                  : (isDark ? "1.5px solid rgba(255,255,255,0.08)" : "1.5px solid rgba(0,0,0,0.08)"),
                boxShadow: dateFocused ? (isDark ? "0 0 0 3px rgba(196,163,90,0.12)" : "0 0 0 3px rgba(140,107,42,0.10)") : "none",
              }}
            />
          </label>
          
          <label style={{ ...labelStyle, color: isDark ? "#8A8278" : "rgba(24,20,14,0.48)" }}>
            Time
            <TimeSlotControl
              value={draftSchedule.eventTime}
              slots={slots}
              loading={slotLoading}
              scheduleEnforced={scheduleEnforced}
              emptyMessage={scheduleMessage}
              onChange={(eventTime) => setDraftSchedule({ ...draftSchedule, eventTime })}
              style={controlStyle(isDark)}
              isDark={isDark}
            />
          </label>
        </div>

        {(slotError || selectedSlot?.reason || scheduleMessage) && (
          <div style={{ fontSize: 11.5, lineHeight: 1.45, color: selectedSlot?.reason ? "#B85C5C" : (isDark ? "#8A8278" : "rgba(24,20,14,0.52)") }}>
            {selectedSlot?.reason || scheduleMessage || slotError}
          </div>
        )}
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
        background: isDark ? "#111009" : "#FFFFFF",
        border: isDark ? "1.5px solid rgba(196,163,90,0.22)" : "1.5px solid rgba(0,0,0,0.08)",
        boxShadow: "0 24px 80px rgba(0,0,0,0.24)",
      }}>
        <div style={{ height: 2, background: isDark ? "linear-gradient(90deg, transparent, rgba(196,163,90,0.75), transparent)" : "linear-gradient(90deg, transparent, rgba(140,107,42,0.75), transparent)" }} />
        <div style={{ padding: "20px 22px 18px", background: isDark ? "linear-gradient(160deg,#161410 0%,#111009 100%)" : "linear-gradient(160deg,#FAF8F4 0%,#F2EFE8 100%)", borderBottom: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: "0.22em", color: isDark ? "#C4A35A" : "#8C6B2A", textTransform: "uppercase", marginBottom: 6 }}>
            Select Schedule First
          </div>
          <div style={{ fontSize: 20, fontWeight: 700, color: isDark ? "#EDE8DF" : "#18140E", lineHeight: 1.2 }}>
            Check availability for {roomLabel}
          </div>
        </div>
        <div style={{ padding: "20px 22px 24px" }}>
          <div style={{ fontSize: 12.5, color: isDark ? "#8A8278" : "#7A7060", lineHeight: 1.65, marginBottom: 16 }}>
            Seat and table status depends on the reservation date and time. Choose a schedule before selecting a seat/table.
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <label style={{ ...labelStyle, color: isDark ? "#8A8278" : "rgba(24,20,14,0.48)" }}>
              Date
              <input
                type="date"
                value={draftSchedule.eventDate}
                onChange={(event) => setDraftSchedule({ ...draftSchedule, eventDate: event.target.value })}
                style={{
                  ...modalInputStyle(isDark),
                  border: isDark ? "1.5px solid rgba(255,255,255,0.08)" : "1.5px solid rgba(0,0,0,0.10)",
                }}
              />
            </label>
            <label style={{ ...labelStyle, color: isDark ? "#8A8278" : "rgba(24,20,14,0.48)" }}>
              Time
              <TimeSlotControl
                value={draftSchedule.eventTime}
                slots={slots}
                loading={slotLoading}
                scheduleEnforced={scheduleEnforced}
                emptyMessage={scheduleMessage}
                onChange={(eventTime) => setDraftSchedule({ ...draftSchedule, eventTime })}
                style={modalInputStyle(isDark)}
                isDark={isDark}
              />
            </label>
            {(slotError || selectedSlot?.reason || scheduleMessage) && (
              <div style={{ fontSize: 12, lineHeight: 1.5, color: selectedSlot?.reason ? "#B85C5C" : (isDark ? "#8A8278" : "#7A7060") }}>
                {selectedSlot?.reason || scheduleMessage || slotError}
              </div>
            )}
            <button
              type="button"
              onClick={confirmSchedule}
              disabled={!isDraftValid}
              style={confirmButtonStyle(isDark, isDraftValid)}
            >
              Confirm Schedule
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TimeSlotControl({ value, slots, loading, scheduleEnforced = false, emptyMessage = "", onChange, style, isDark }) {
  if (!slots.length) {
    if (scheduleEnforced) {
      return (
        <BellevueDropdown
          value=""
          disabled
          options={[]}
          placeholder={loading ? "Loading..." : "No available times"}
          isDark={isDark}
          style={style}
        />
      );
    }

    return (
      <input
        type="time"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{
          ...style,
          colorScheme: isDark ? "dark" : "light"
        }}
      />
    );
  }

  return (
    <BellevueDropdown
      value={String(value || "").substring(0, 5)}
      onChange={(val) => onChange(val)}
      options={slots}
      placeholder="Select a time"
      isDark={isDark}
      disabled={loading}
      style={style}
    />
  );
}

function controlStyle(isDark) {
  return {
    width: "100%",
    height: 40,
    boxSizing: "border-box",
    padding: "0 14px",
    border: isDark ? "1.5px solid rgba(255,255,255,0.08)" : "1.5px solid rgba(0,0,0,0.08)",
    borderRadius: 8,
    background: isDark ? "rgba(255,255,255,0.04)" : "#FFFFFF",
    color: isDark ? "#EDE8DF" : "#18140E",
    fontSize: 13,
    fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
    outline: "none",
    transition: "border-color 0.18s, box-shadow 0.18s",
  };
}

function confirmButtonStyle(isDark, isActive) {
  return {
    height: 40, // Uniform 40px height
    border: 0,
    borderRadius: 8,
    background: isActive ? (isDark ? "#C4A35A" : "#8C6B2A") : (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.05)"),
    color: isActive ? (isDark ? "#0A0908" : "#FFFFFF") : (isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.25)"),
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
    cursor: isActive ? "pointer" : "not-allowed",
    transition: "all 0.18s ease",
  };
}

const labelStyle = {
  display: "grid",
  gap: 7,
  fontSize: 9,
  fontWeight: 800,
  letterSpacing: "0.16em",
  textTransform: "uppercase",
};

function modalInputStyle(isDark) {
  return {
    width: "100%",
    height: 40,
    boxSizing: "border-box",
    border: isDark ? "1.5px solid rgba(255,255,255,0.08)" : "1.5px solid rgba(0,0,0,0.10)",
    borderRadius: 8,
    background: isDark ? "rgba(255,255,255,0.04)" : "#FFFFFF",
    color: isDark ? "#EDE8DF" : "#18140E",
    padding: "0 11px",
    fontSize: 13,
    fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
    outline: "none",
    colorScheme: isDark ? "dark" : "light"
  };
}
