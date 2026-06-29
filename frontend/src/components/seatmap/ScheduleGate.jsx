import React, { useState, useRef } from "react";
import { venueAPI } from "../../services/venueAPI";
import BellevueDropdown from "../BellevueDropdown";

export function getLocalTodayString() {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatDisplayDate(dateStr) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDisplayTime(timeStr) {
  if (!timeStr) return "";
  const parts = timeStr.split(":");
  const hr = parseInt(parts[0], 10);
  const min = parts[1] || "00";
  if (isNaN(hr)) return timeStr;
  const ampm = hr >= 12 ? "PM" : "AM";
  const formattedHr = hr % 12 || 12;
  return `${formattedHr}:${min} ${ampm}`;
}

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
  const today = getLocalTodayString();
  let eventDate = schedule.eventDate || stored.eventDate || "";
  if (eventDate && eventDate < today) {
    eventDate = "";
  }
  return {
    eventDate,
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

  const lastPropRef = React.useRef({ eventDate: normalized.eventDate, eventTime: normalized.eventTime });
  if (normalized.eventDate !== lastPropRef.current.eventDate || 
      normalized.eventTime !== lastPropRef.current.eventTime) {
    lastPropRef.current = { eventDate: normalized.eventDate, eventTime: normalized.eventTime };
    setDraftSchedule(normalized);
  }

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
  const localToday = getLocalTodayString();
  const isDraftValid = Boolean(draftSchedule.eventDate && draftSchedule.eventDate >= localToday && draftSchedule.eventTime && slotAvailable);
  const hasChanges =
    draftSchedule.eventDate !== normalized.eventDate ||
    draftSchedule.eventTime !== normalized.eventTime;

  React.useEffect(() => {
    if (isReady && draftSchedule.eventDate && draftSchedule.eventTime && !slotLoading) {
      const selectedSlot = slots.find((slot) => slot.time === String(draftSchedule.eventTime || "").substring(0, 5));
      const slotAvailable = slots.length === 0 ? !scheduleEnforced : Boolean(selectedSlot?.available);
      
      if (slotAvailable) {
        if (draftSchedule.eventDate !== normalized.eventDate || draftSchedule.eventTime !== normalized.eventTime) {
          onChange(saveSeatmapSchedule(draftSchedule));
        }
      }
    }
  }, [draftSchedule, slots, slotLoading, scheduleEnforced, isReady, onChange, normalized.eventDate, normalized.eventTime]);

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
            <CustomDateInput
              value={draftSchedule.eventDate}
              min={getLocalTodayString()}
              onChange={(event) => {
                const selectedDate = event.target.value;
                const today = getLocalTodayString();
                if (selectedDate && selectedDate < today) {
                  setDraftSchedule({ ...draftSchedule, eventDate: today });
                } else {
                  setDraftSchedule({ ...draftSchedule, eventDate: selectedDate });
                }
              }}
              isDark={isDark}
              style={controlStyle(isDark)}
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
              <CustomDateInput
                value={draftSchedule.eventDate}
                min={getLocalTodayString()}
                onChange={(event) => {
                  const selectedDate = event.target.value;
                  const today = getLocalTodayString();
                  if (selectedDate && selectedDate < today) {
                    setDraftSchedule({ ...draftSchedule, eventDate: today });
                  } else {
                    setDraftSchedule({ ...draftSchedule, eventDate: selectedDate });
                  }
                }}
                isDark={isDark}
                style={modalInputStyle(isDark)}
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
      <CustomTimeInput
        value={value}
        onChange={(val) => onChange(val)}
        isDark={isDark}
        style={style}
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

export function CustomDateInput({ value, min, onChange, onFocus, onBlur, isDark, placeholder = "Select Date", style = {} }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const handleClick = () => {
    if (inputRef.current && typeof inputRef.current.showPicker === "function") {
      try {
        inputRef.current.showPicker();
      } catch (err) {}
    }
  };

  const {
    width,
    height,
    margin,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    flex,
    gridArea,
    padding,
    ...visualStyles
  } = style || {};

  return (
    <div
      style={{
        position: "relative",
        width: width || "100%",
        margin,
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
        flex,
        gridArea,
        display: "flex",
        alignItems: "center",
      }}
      onClick={handleClick}
    >
      <div
        style={{
          width: "100%",
          height: 40,
          boxSizing: "border-box",
          padding: "0 14px",
          border: focused
            ? (isDark ? "1.5px solid rgba(196,163,90,0.35)" : "1.5px solid rgba(140,107,42,0.32)")
            : (isDark ? "1.5px solid rgba(255,255,255,0.08)" : "1.5px solid rgba(0,0,0,0.08)"),
          borderRadius: 8,
          background: isDark ? "rgba(255,255,255,0.04)" : "#FFFFFF",
          color: value 
            ? (isDark ? "#EDE8DF" : "#18140E") 
            : (isDark ? "#8A8278" : "rgba(24,20,14,0.48)"),
          fontSize: 13,
          fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: focused ? (isDark ? "0 0 0 3px rgba(196,163,90,0.12)" : "0 0 0 3px rgba(140,107,42,0.10)") : "none",
          transition: "border-color 0.18s, box-shadow 0.18s",
          cursor: "pointer",
          ...visualStyles,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value ? formatDisplayDate(value) : placeholder}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isDark ? "#C4A35A" : "#8C6B2A"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, marginLeft: 8 }}
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      </div>
      <input
        ref={inputRef}
        type="date"
        value={value}
        min={min}
        onFocus={(e) => {
          setFocused(true);
          if (onFocus) onFocus(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          if (onBlur) onBlur(e);
        }}
        onChange={onChange}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
          zIndex: 2,
          WebkitAppearance: "none",
          appearance: "none",
        }}
      />
    </div>
  );
}

export function CustomTimeInput({ value, onChange, onFocus, onBlur, isDark, placeholder = "Select Time", style = {} }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  const handleClick = () => {
    if (inputRef.current && typeof inputRef.current.showPicker === "function") {
      try {
        inputRef.current.showPicker();
      } catch (err) {}
    }
  };

  const {
    width,
    height,
    margin,
    marginTop,
    marginRight,
    marginBottom,
    marginLeft,
    flex,
    gridArea,
    padding,
    ...visualStyles
  } = style || {};

  return (
    <div
      style={{
        position: "relative",
        width: width || "100%",
        margin,
        marginTop,
        marginRight,
        marginBottom,
        marginLeft,
        flex,
        gridArea,
        display: "flex",
        alignItems: "center",
      }}
      onClick={handleClick}
    >
      <div
        style={{
          width: "100%",
          height: 40,
          boxSizing: "border-box",
          padding: "0 14px",
          border: focused
            ? (isDark ? "1.5px solid rgba(196,163,90,0.35)" : "1.5px solid rgba(140,107,42,0.32)")
            : (isDark ? "1.5px solid rgba(255,255,255,0.08)" : "1.5px solid rgba(0,0,0,0.08)"),
          borderRadius: 8,
          background: isDark ? "rgba(255,255,255,0.04)" : "#FFFFFF",
          color: value 
            ? (isDark ? "#EDE8DF" : "#18140E") 
            : (isDark ? "#8A8278" : "rgba(24,20,14,0.48)"),
          fontSize: 13,
          fontFamily: "'Inter','Helvetica Neue',Arial,sans-serif",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          boxShadow: focused ? (isDark ? "0 0 0 3px rgba(196,163,90,0.12)" : "0 0 0 3px rgba(140,107,42,0.10)") : "none",
          transition: "border-color 0.18s, box-shadow 0.18s",
          cursor: "pointer",
          ...visualStyles,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {value ? formatDisplayTime(value) : placeholder}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke={isDark ? "#C4A35A" : "#8C6B2A"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ flexShrink: 0, marginLeft: 8 }}
        >
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      </div>
      <input
        ref={inputRef}
        type="time"
        value={value}
        onFocus={(e) => {
          setFocused(true);
          if (onFocus) onFocus(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          if (onBlur) onBlur(e);
        }}
        onChange={(event) => onChange(event.target.value)}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "pointer",
          zIndex: 2,
          WebkitAppearance: "none",
          appearance: "none",
        }}
      />
    </div>
  );
}
