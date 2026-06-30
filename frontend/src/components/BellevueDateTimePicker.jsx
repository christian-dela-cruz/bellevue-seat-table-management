import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, X, Clock } from "lucide-react";
import { useAdminTheme, C, F } from "../context/AdminThemeContext";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Helper to parse date string YYYY-MM-DDTHH:mm into Date object (local timezone)
const parseDateTime = (str) => {
  if (!str || typeof str !== "string") return null;
  const parts = str.split(/[T ]/);
  if (parts.length < 1) return null;
  const dateParts = parts[0].split("-");
  if (dateParts.length < 3) return null;

  let hours = 0;
  let minutes = 0;
  if (parts[1]) {
    const timeParts = parts[1].split(":");
    hours = parseInt(timeParts[0], 10) || 0;
    minutes = parseInt(timeParts[1], 10) || 0;
  }

  const year = parseInt(dateParts[0], 10);
  const month = parseInt(dateParts[1], 10) - 1; // 0-indexed
  const day = parseInt(dateParts[2], 10);

  const date = new Date(year, month, day, hours, minutes);
  return isNaN(date.getTime()) ? null : date;
};

// Helper to format Date object into YYYY-MM-DDTHH:mm
const formatDateTime = (date) => {
  if (!date) return "";
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
};

export default function BellevueDateTimePicker({
  value,
  onChange,
  required = false,
  placeholder = "Select date & time",
  disabled = false,
  style = {},
}) {
  const { isDark } = useAdminTheme();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const triggerRef = useRef(null);
  const dropdownRef = useRef(null);
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 0 });
  const [windowWidth, setWindowWidth] = useState(typeof window !== "undefined" ? window.innerWidth : 1024);

  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const isMobile = windowWidth < 480;

  // Currently viewed month/year in calendar
  const [viewDate, setViewDate] = useState(() => {
    const current = parseDateTime(value) || new Date();
    return new Date(current.getFullYear(), current.getMonth(), 1);
  });

  // Keep viewDate in sync when value changes externally
  useEffect(() => {
    const parsed = parseDateTime(value);
    if (parsed) {
      setViewDate(new Date(parsed.getFullYear(), parsed.getMonth(), 1));
    }
  }, [value]);

  const updateCoords = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const calendarWidth = 320;
      let left = rect.left + window.scrollX;
      
      // Shift left if calendar would overflow the screen width
      if (rect.left + calendarWidth > window.innerWidth) {
        left = window.innerWidth - calendarWidth - 16 + window.scrollX;
      }
      left = Math.max(8, left);

      setCoords({
        top: rect.bottom + window.scrollY,
        left: left,
        width: rect.width,
      });
    }
  };

  useEffect(() => {
    if (isOpen) {
      updateCoords();
      // Listen to scroll & resize to reposition popover dynamically
      window.addEventListener("scroll", updateCoords, true);
      window.addEventListener("resize", updateCoords);
    }
    return () => {
      window.removeEventListener("scroll", updateCoords, true);
      window.removeEventListener("resize", updateCoords);
    };
  }, [isOpen]);

  // Click outside listener
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (
        containerRef.current && !containerRef.current.contains(e.target) &&
        dropdownRef.current && !dropdownRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const handleToggle = (e) => {
    e.preventDefault();
    if (disabled) return;
    setIsOpen(!isOpen);
  };

  const selectedDate = parseDateTime(value);

  // Month navigation
  const handlePrevMonth = (e) => {
    e.preventDefault();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const handleNextMonth = (e) => {
    e.preventDefault();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  const handleYearChange = (e) => {
    const nextYear = parseInt(e.target.value, 10);
    setViewDate(new Date(nextYear, viewDate.getMonth(), 1));
  };

  const handleMonthChange = (e) => {
    const nextMonth = parseInt(e.target.value, 10);
    setViewDate(new Date(viewDate.getFullYear(), nextMonth, 1));
  };

  // Generate calendar cells (42 days grid)
  const getCalendarDays = () => {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const prevTotalDays = new Date(year, month, 0).getDate();

    const days = [];

    // Prev month days
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      days.push({
        day: prevTotalDays - i,
        month: month === 0 ? 11 : month - 1,
        year: month === 0 ? year - 1 : year,
        isCurrentMonth: false,
      });
    }

    // Current month days
    for (let i = 1; i <= totalDays; i++) {
      days.push({
        day: i,
        month,
        year,
        isCurrentMonth: true,
      });
    }

    // Next month days
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({
        day: i,
        month: month === 11 ? 0 : month + 1,
        year: month === 11 ? year + 1 : year,
        isCurrentMonth: false,
      });
    }

    return days;
  };

  const handleDaySelect = (item) => {
    const currentVal = selectedDate || new Date();
    const updated = new Date(
      item.year,
      item.month,
      item.day,
      currentVal.getHours(),
      currentVal.getMinutes()
    );
    onChange(formatDateTime(updated));
  };

  // Time handling (12-hour AM/PM based selectors)
  const currentHour24 = selectedDate ? selectedDate.getHours() : 12;
  const currentMinute = selectedDate ? selectedDate.getMinutes() : 0;
  
  let displayHour = currentHour24 % 12;
  if (displayHour === 0) displayHour = 12;
  const displayPeriod = currentHour24 >= 12 ? "PM" : "AM";

  const handleTimeChange = (type, val) => {
    let hour = currentHour24;
    let minute = currentMinute;

    if (type === "hour") {
      const h = parseInt(val, 10);
      if (displayPeriod === "PM" && h < 12) hour = h + 12;
      else if (displayPeriod === "AM" && h === 12) hour = 0;
      else hour = h;
    } else if (type === "minute") {
      minute = parseInt(val, 10);
    } else if (type === "period") {
      if (val === "PM" && hour < 12) hour += 12;
      if (val === "AM" && hour >= 12) hour -= 12;
    }

    const currentVal = selectedDate || new Date();
    const updated = new Date(
      currentVal.getFullYear(),
      currentVal.getMonth(),
      currentVal.getDate(),
      hour,
      minute
    );
    onChange(formatDateTime(updated));
  };

  const handleSelectToday = (e) => {
    e.preventDefault();
    const today = new Date();
    const currentVal = selectedDate || new Date();
    const updated = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      currentVal.getHours(),
      currentVal.getMinutes()
    );
    onChange(formatDateTime(updated));
    setViewDate(new Date(today.getFullYear(), today.getMonth(), 1));
  };

  const handleSelectNow = (e) => {
    e.preventDefault();
    const now = new Date();
    onChange(formatDateTime(now));
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  // Human-readable representation of selected date
  const displayValue = selectedDate
    ? selectedDate.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "";

  const calendarDays = getCalendarDays();
  const todayDate = new Date();

  // Create years array for quick selection (e.g. 5 years backward to 10 years forward)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 16 }, (_, i) => currentYear - 5 + i);

  return (
    <div
      ref={containerRef}
      style={{
        position: "relative",
        width: "100%",
        fontFamily: F.body,
        boxSizing: "border-box",
        ...style,
      }}
    >
      {/* Hidden input to hold state and trigger native validation if required */}
      <input
        type="text"
        required={required}
        value={value || ""}
        onChange={() => {}}
        tabIndex={-1}
        style={{
          position: "absolute",
          width: "100%",
          height: 0,
          opacity: 0,
          pointerEvents: "none",
        }}
      />

      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        style={{
          width: "100%",
          height: 38,
          boxSizing: "border-box",
          padding: "0 12px",
          border: `1.5px solid ${isOpen ? C.gold : C.border}`,
          borderRadius: 8,
          background: C.surfaceInput,
          color: displayValue ? C.text : C.muted,
          fontFamily: F.body,
          fontSize: 13,
          textAlign: "left",
          outline: "none",
          cursor: disabled ? "not-allowed" : "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          transition: "border-color 0.18s, box-shadow 0.18s",
          boxShadow: isOpen ? C.inputFocusShadow : "none",
          opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {displayValue || placeholder}
        </span>
        <CalendarDays size={16} style={{ color: isOpen ? C.gold : C.muted, flexShrink: 0 }} />
      </button>

      {isOpen && createPortal(
        isMobile ? (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(24, 20, 14, 0.6)",
              backdropFilter: "blur(2px)",
              zIndex: 999999,
              display: "grid",
              placeItems: "center",
              padding: 16,
              animation: "modalFadeIn 200ms ease",
            }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsOpen(false);
            }}
          >
            <div
              ref={dropdownRef}
              style={{
                width: "100%",
                maxWidth: 320,
                background: C.surface,
                border: `1.5px solid ${C.gold}`,
                borderRadius: 12,
                boxShadow: isDark
                  ? "0 12px 36px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.4)"
                  : "0 12px 36px rgba(140,107,42,0.18), 0 2px 8px rgba(140,107,42,0.06)",
                padding: 16,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                gap: 12,
                animation: "modalIn 250ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            >
              {/* Header Month/Year Navigation */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: C.text,
                    cursor: "pointer",
                    padding: 4,
                    borderRadius: 6,
                    display: "grid",
                    placeItems: "center",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = C.soft}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <ChevronLeft size={16} />
                </button>

                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {/* Quick Select Month */}
                  <select
                    value={viewDate.getMonth()}
                    onChange={handleMonthChange}
                    style={{
                      background: C.soft,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      color: C.text,
                      fontSize: 12.5,
                      fontWeight: 600,
                      padding: "2px 6px",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={name} value={idx}>{name}</option>
                    ))}
                  </select>

                  {/* Quick Select Year */}
                  <select
                    value={viewDate.getFullYear()}
                    onChange={handleYearChange}
                    style={{
                      background: C.soft,
                      border: `1px solid ${C.border}`,
                      borderRadius: 6,
                      color: C.text,
                      fontSize: 12.5,
                      fontWeight: 600,
                      padding: "2px 6px",
                      cursor: "pointer",
                      outline: "none",
                    }}
                  >
                    {years.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  style={{
                    background: "transparent",
                    border: "none",
                    color: C.text,
                    cursor: "pointer",
                    padding: 4,
                    borderRadius: 6,
                    display: "grid",
                    placeItems: "center",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = C.soft}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              {/* Weekday Labels */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", rowGap: 4 }}>
                {WEEKDAYS.map((d) => (
                  <span key={d} style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: C.muted }}>
                    {d}
                  </span>
                ))}
              </div>

              {/* Calendar Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {calendarDays.map((item, idx) => {
                  const isSelected = selectedDate &&
                    selectedDate.getDate() === item.day &&
                    selectedDate.getMonth() === item.month &&
                    selectedDate.getFullYear() === item.year;

                  const isToday = todayDate.getDate() === item.day &&
                    todayDate.getMonth() === item.month &&
                    todayDate.getFullYear() === item.year;

                  return (
                    <button
                      key={`${item.year}-${item.month}-${item.day}-${idx}`}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleDaySelect(item);
                      }}
                      style={{
                        height: 32,
                        borderRadius: 6,
                        background: isSelected
                          ? C.gold
                          : isToday
                          ? C.goldFaint
                          : "transparent",
                        color: isSelected
                          ? "#FFFFFF"
                          : !item.isCurrentMonth
                          ? C.textTertiary
                          : isToday
                          ? C.gold
                          : C.text,
                        fontSize: 12,
                        fontWeight: isSelected || isToday ? 700 : 400,
                        cursor: "pointer",
                        outline: "none",
                        border: isToday && !isSelected ? `1px solid ${C.gold}` : "none",
                        display: "grid",
                        placeItems: "center",
                        transition: "background 0.15s, color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected) e.currentTarget.style.background = C.soft;
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected) e.currentTarget.style.background = isToday ? C.goldFaint : "transparent";
                      }}
                    >
                      {item.day}
                    </button>
                  );
                })}
              </div>

              <div style={{ height: "1px", background: C.divider, margin: "2px 0" }} />

              {/* Time Picker Row */}
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted, display: "flex", alignItems: "center", gap: 5 }}>
                  <Clock size={12} /> Time Selector
                </span>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {/* Hours Dropdown */}
                  <select
                    value={displayHour}
                    onChange={(e) => handleTimeChange("hour", e.target.value)}
                    style={{
                      flex: 1,
                      background: C.soft,
                      border: `1.5px solid ${C.border}`,
                      borderRadius: 8,
                      color: C.text,
                      fontSize: 13,
                      padding: "6px 8px",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                      <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
                    ))}
                  </select>

                  <span style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>:</span>

                  {/* Minutes Dropdown */}
                  <select
                    value={currentMinute}
                    onChange={(e) => handleTimeChange("minute", e.target.value)}
                    style={{
                      flex: 1,
                      background: C.soft,
                      border: `1.5px solid ${C.border}`,
                      borderRadius: 8,
                      color: C.text,
                      fontSize: 13,
                      padding: "6px 8px",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                      <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                    ))}
                  </select>

                  {/* AM/PM Dropdown */}
                  <select
                    value={displayPeriod}
                    onChange={(e) => handleTimeChange("period", e.target.value)}
                    style={{
                      flex: 1,
                      background: C.soft,
                      border: `1.5px solid ${C.border}`,
                      borderRadius: 8,
                      color: C.text,
                      fontSize: 13,
                      padding: "6px 8px",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="AM">AM</option>
                    <option value="PM">PM</option>
                  </select>
                </div>
              </div>

              <div style={{ height: "1px", background: C.divider, margin: "2px 0" }} />

              {/* Quick Buttons / Actions */}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="button"
                  onClick={handleSelectToday}
                  style={{
                    flex: 1,
                    padding: "6px 0",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    background: C.soft,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.text,
                    cursor: "pointer",
                  }}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={handleSelectNow}
                  style={{
                    flex: 1,
                    padding: "6px 0",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    background: C.soft,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.text,
                    cursor: "pointer",
                  }}
                >
                  Now
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsOpen(false);
                  }}
                  style={{
                    flex: 1.2,
                    padding: "6px 0",
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    background: C.gold,
                    border: "none",
                    borderRadius: 6,
                    color: "#FFFFFF",
                    cursor: "pointer",
                  }}
                >
                  Done
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div
            ref={dropdownRef}
            style={{
              position: "absolute",
              top: coords.top + 6,
              left: coords.left,
              width: 320,
              zIndex: 999999,
              background: C.surface,
              border: `1.5px solid ${C.gold}`,
              borderRadius: 12,
              boxShadow: isDark
                ? "0 12px 36px rgba(0,0,0,0.65), 0 2px 8px rgba(0,0,0,0.4)"
                : "0 12px 36px rgba(140,107,42,0.18), 0 2px 8px rgba(140,107,42,0.06)",
              padding: 16,
              boxSizing: "border-box",
              display: "flex",
              flexDirection: "column",
              gap: 12,
              animation: "modalFadeIn 180ms ease both",
            }}
          >
            {/* Header Month/Year Navigation */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
              <button
                type="button"
                onClick={handlePrevMonth}
                style={{
                  background: "transparent",
                  border: "none",
                  color: C.text,
                  cursor: "pointer",
                  padding: 4,
                  borderRadius: 6,
                  display: "grid",
                  placeItems: "center",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = C.soft}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <ChevronLeft size={16} />
              </button>

              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {/* Quick Select Month */}
                <select
                  value={viewDate.getMonth()}
                  onChange={handleMonthChange}
                  style={{
                    background: C.soft,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.text,
                    fontSize: 12.5,
                    fontWeight: 600,
                    padding: "2px 6px",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx}>{name}</option>
                  ))}
                </select>

                {/* Quick Select Year */}
                <select
                  value={viewDate.getFullYear()}
                  onChange={handleYearChange}
                  style={{
                    background: C.soft,
                    border: `1px solid ${C.border}`,
                    borderRadius: 6,
                    color: C.text,
                    fontSize: 12.5,
                    fontWeight: 600,
                    padding: "2px 6px",
                    cursor: "pointer",
                    outline: "none",
                  }}
                >
                  {years.map((y) => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleNextMonth}
                style={{
                  background: "transparent",
                  border: "none",
                  color: C.text,
                  cursor: "pointer",
                  padding: 4,
                  borderRadius: 6,
                  display: "grid",
                  placeItems: "center",
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = C.soft}
                onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
              >
                <ChevronRight size={16} />
              </button>
            </div>

            {/* Weekday Labels */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textAlign: "center", rowGap: 4 }}>
              {WEEKDAYS.map((d) => (
                <span key={d} style={{ fontSize: 10.5, fontWeight: 700, textTransform: "uppercase", color: C.muted }}>
                  {d}
                </span>
              ))}
            </div>

            {/* Calendar Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
              {calendarDays.map((item, idx) => {
                const isSelected = selectedDate &&
                  selectedDate.getDate() === item.day &&
                  selectedDate.getMonth() === item.month &&
                  selectedDate.getFullYear() === item.year;

                const isToday = todayDate.getDate() === item.day &&
                  todayDate.getMonth() === item.month &&
                  todayDate.getFullYear() === item.year;

                return (
                  <button
                    key={`${item.year}-${item.month}-${item.day}-${idx}`}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleDaySelect(item);
                    }}
                    style={{
                      height: 32,
                      borderRadius: 6,
                      background: isSelected
                        ? C.gold
                        : isToday
                        ? C.goldFaint
                        : "transparent",
                      color: isSelected
                        ? "#FFFFFF"
                        : !item.isCurrentMonth
                        ? C.textTertiary
                        : isToday
                        ? C.gold
                        : C.text,
                      fontSize: 12,
                      fontWeight: isSelected || isToday ? 700 : 400,
                      cursor: "pointer",
                      outline: "none",
                      border: isToday && !isSelected ? `1px solid ${C.gold}` : "none",
                      display: "grid",
                      placeItems: "center",
                      transition: "background 0.15s, color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = C.soft;
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = isToday ? C.goldFaint : "transparent";
                    }}
                  >
                    {item.day}
                  </button>
                );
              })}
            </div>

            <div style={{ height: "1px", background: C.divider, margin: "2px 0" }} />

            {/* Time Picker Row */}
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: C.muted, display: "flex", alignItems: "center", gap: 5 }}>
                <Clock size={12} /> Time Selector
              </span>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {/* Hours Dropdown */}
                <select
                  value={displayHour}
                  onChange={(e) => handleTimeChange("hour", e.target.value)}
                  style={{
                    flex: 1,
                    background: C.soft,
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 8,
                    color: C.text,
                    fontSize: 13,
                    padding: "6px 8px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((h) => (
                    <option key={h} value={h}>{String(h).padStart(2, "0")}</option>
                  ))}
                </select>

                <span style={{ color: C.text, fontSize: 14, fontWeight: 600 }}>:</span>

                {/* Minutes Dropdown */}
                <select
                  value={currentMinute}
                  onChange={(e) => handleTimeChange("minute", e.target.value)}
                  style={{
                    flex: 1,
                    background: C.soft,
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 8,
                    color: C.text,
                    fontSize: 13,
                    padding: "6px 8px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                    <option key={m} value={m}>{String(m).padStart(2, "0")}</option>
                  ))}
                </select>

                {/* AM/PM Dropdown */}
                <select
                  value={displayPeriod}
                  onChange={(e) => handleTimeChange("period", e.target.value)}
                  style={{
                    flex: 1,
                    background: C.soft,
                    border: `1.5px solid ${C.border}`,
                    borderRadius: 8,
                    color: C.text,
                    fontSize: 13,
                    padding: "6px 8px",
                    outline: "none",
                    cursor: "pointer",
                  }}
                >
                  <option value="AM">AM</option>
                  <option value="PM">PM</option>
                </select>
              </div>
            </div>

            <div style={{ height: "1px", background: C.divider, margin: "2px 0" }} />

            {/* Quick Buttons / Actions */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={handleSelectToday}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  background: C.soft,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.text,
                  cursor: "pointer",
                }}
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleSelectNow}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  background: C.soft,
                  border: `1px solid ${C.border}`,
                  borderRadius: 6,
                  color: C.text,
                  cursor: "pointer",
                }}
              >
                Now
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setIsOpen(false);
                }}
                style={{
                  flex: 1.2,
                  padding: "6px 0",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  background: C.gold,
                  border: "none",
                  borderRadius: 6,
                  color: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                Done
              </button>
            </div>
          </div>
        ),
        document.body
      )}
    </div>
  );
}
