import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Edit3,
  Eye,
  EyeOff,
  GripVertical,
  Layers,
  MoreHorizontal,
  Plus,
  Search,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Upload,
  X,
  LayoutGrid,
  List,
  Wand2,
  Grid,
  Monitor,
  RotateCcw,
  AlertTriangle
} from "lucide-react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import Sidebar from "../../../components/layout/Sidebar";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
import ImageUploaderCropper from "../../../components/ImageUploaderCropper";
import { authAPI } from "../../../services/authAPI";
import { venueAPI } from "../../../services/venueAPI";
import { eventAPI } from "../../../services/eventAPI";
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, rectSortingStrategy, arrayMove, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import clientDisplayAPI from "../../../services/clientDisplayAPI";
import { buildDiningOutletsFromConfig, buildEventVenuesFromConfig, VenueCard } from "../../client/pages/ReservationLanding";

import { useAdminTheme, C, F } from "../../../context/AdminThemeContext";

class DrawerErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, info) {
    console.error('[DrawerErrorBoundary] Caught:', error, info?.componentStack);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, color: '#c00', fontFamily: 'monospace', fontSize: 13, whiteSpace: 'pre-wrap', background: '#fff8f8', border: '2px solid #c00', borderRadius: 12, margin: 20, maxHeight: '80vh', overflow: 'auto' }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 18 }}>⚠️ Drawer Render Error</h2>
          <p><strong>{String(this.state.error)}</strong></p>
          <p style={{ fontSize: 11, color: '#666' }}>{this.state.error?.stack}</p>
          <button type="button" onClick={() => this.setState({ hasError: false, error: null })} style={{ marginTop: 12, padding: '8px 16px', cursor: 'pointer' }}>Retry</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function SortableRow({ id, disabled, level, className, style, children }) {
  const { isDark } = useAdminTheme();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled
  });

  const combinedStyle = {
    ...style,
    transform: CSS.Transform.toString(transform),
    transition,
    ...(isDragging ? { position: 'relative', zIndex: 99, boxShadow: '0 5px 15px rgba(0,0,0,0.15)', opacity: 0.9, background: level ? (isDark ? "rgba(255,255,255,0.08)" : "rgba(250,248,244,0.92)") : C.surface } : {}),
  };

  return (
    <tr ref={setNodeRef} style={combinedStyle} className={className}>
      {children(attributes, listeners, isDragging)}
    </tr>
  );
}

function SortableVenueCard({ id, item, variant: rawVariant, isHidden, onToggleHide }) {
  // Map plural "events" to singular "event" for CSS class consistency
  const variant = rawVariant === "events" ? "event" : rawVariant;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: "relative",
    opacity: isHidden ? 0.4 : 1,
  };

  const isEvent = item.type === "event";

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div style={{ pointerEvents: "none" }}>
        <VenueCard item={item} variant={isEvent ? "event" : variant} isInteractive={false} />
      </div>
      {isEvent && (
        <div style={{
          position: "absolute",
          top: 10, left: 10,
          background: "rgba(164, 120, 33, 0.95)",
          color: "#fff",
          padding: "4px 8px",
          borderRadius: 6,
          fontSize: 10,
          fontWeight: "700",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          zIndex: 20,
          pointerEvents: "none",
        }}>
          Event
        </div>
      )}
      <button
        type="button"
        onPointerDown={(e) => { e.stopPropagation(); }}
        onClick={(e) => { e.stopPropagation(); e.preventDefault(); onToggleHide(id); }}
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          zIndex: 20,
          background: isHidden ? "#111" : "#fff",
          color: isHidden ? "#fff" : "#111",
          border: "1px solid rgba(0,0,0,0.1)",
          borderRadius: 8,
          padding: "4px 8px",
          fontSize: 10,
          fontWeight: 700,
          cursor: "pointer",
          pointerEvents: "auto",
        }}
      >
        {isHidden ? <EyeOff size={14} /> : "Hide"}
      </button>
    </div>
  );
}

const emptyForm = {
  parent_id: "",
  name: "",
  display_name: "",
  slug: "",
  wing: "Main Wing",
  type: "function_room",
  category: "function_room",
  capacity: 0,
  description: "",
  image: "",
  display_order: 0,
  is_active: true,
  is_visible: true,
  show_on_landing: true,
  reservations_enabled: true,
  parent_selectable: true,
  child_selectable: false,
  reservation_route: "",
  image_position: "center 50%",
  metadata: {},
  is_draft: false,
  availability_enabled: true,
  availability_start_time: "08:00",
  availability_end_time: "23:00",
  availability_interval_minutes: 60,
  availability_max_reservations: 0,
  availability_slot_capacity: 0,
  availability_blocked_dates: "",
  availability_blocked_times: "",
  availability_periods: [],
  availability_overrides: [],
  pricing_mode: "",
  base_price: "",
  price_per_person: "",
  price_per_seat: "",
  show_price_to_guest_default: false,
};

function normalizeRoom(room = {}) {
  const availability = room.metadata?.availability || {};
  const capacity = room.capacity ?? 0;
  const legacyOverrides = legacyAvailabilityOverrides(availability);
  return {
    ...emptyForm,
    ...room,
    pricing_mode: room.pricing_mode || "",
    base_price: room.base_price !== null && room.base_price !== undefined ? String(room.base_price) : "",
    price_per_person: room.price_per_person !== null && room.price_per_person !== undefined ? String(room.price_per_person) : "",
    price_per_seat: room.price_per_seat !== null && room.price_per_seat !== undefined ? String(room.price_per_seat) : "",
    show_price_to_guest_default: !!room.show_price_to_guest_default,
    parent_id: room.parent_id ? String(room.parent_id) : "",
    capacity,
    display_order: room.display_order ?? 0,
    display_name: room.display_name || room.name || "",
    slug: room.slug || "",
    image: room.image || "",
    reservation_route: room.reservation_route || "",
    image_position: room.image_position || "center 50%",
    metadata: room.metadata || {},
    availability_enabled: availability.enabled ?? true,
    availability_start_time: availability.start_time || (room.type === "dining" ? "11:00" : "08:00"),
    availability_end_time: availability.end_time || (room.type === "dining" ? "22:00" : "23:00"),
    availability_interval_minutes: availability.interval_minutes ?? (room.type === "dining" ? 30 : 60),
    availability_max_reservations: availability.max_reservations_per_slot ?? 0,
    availability_slot_capacity: availability.slot_capacity ?? capacity,
    availability_blocked_dates: "",
    availability_blocked_times: "",
    availability_periods: normalizeSchedulePeriods(availability.periods, room),
    availability_overrides: uniqueScheduleOverrides([...normalizeScheduleOverrides(availability.overrides), ...legacyOverrides]),
  };
}

const DAY_OPTIONS = [
  ["0", "Sun"],
  ["1", "Mon"],
  ["2", "Tue"],
  ["3", "Wed"],
  ["4", "Thu"],
  ["5", "Fri"],
  ["6", "Sat"],
];

const EDITOR_TABS = [
  ["details", "Details"],
  ["availability", "Visibility"],
  ["schedule", "Schedule"],
  ["exceptions", "Exceptions"],
  ["pricing", "Pricing"],
  ["preview", "Preview"],
];

const SCHEDULE_PRESETS = {
  dining: [
    { label: "Breakfast", service_type: "Breakfast service", days: [0, 1, 2, 3, 4, 5, 6], start_time: "06:00", end_time: "10:00", interval_minutes: 30 },
    { label: "Lunch", service_type: "Lunch service", days: [0, 1, 2, 3, 4, 5, 6], start_time: "11:30", end_time: "14:30", interval_minutes: 30 },
    { label: "Dinner", service_type: "Dinner service", days: [0, 1, 2, 3, 4, 5, 6], start_time: "18:00", end_time: "22:00", interval_minutes: 30 },
    { label: "Daily Dining", service_type: "All-day dining", days: [0, 1, 2, 3, 4, 5, 6], start_time: "06:00", end_time: "22:00", interval_minutes: 30 },
  ],
  function_room: [
    { label: "Event Window", service_type: "Full-day event", days: [0, 1, 2, 3, 4, 5, 6], start_time: "08:00", end_time: "23:00", interval_minutes: 60 },
    { label: "Morning Event", service_type: "Function reservation", days: [0, 1, 2, 3, 4, 5, 6], start_time: "08:00", end_time: "12:00", interval_minutes: 60 },
    { label: "Afternoon Event", service_type: "Function reservation", days: [0, 1, 2, 3, 4, 5, 6], start_time: "13:00", end_time: "17:00", interval_minutes: 60 },
    { label: "Evening Event", service_type: "Function reservation", days: [0, 1, 2, 3, 4, 5, 6], start_time: "18:00", end_time: "23:00", interval_minutes: 60 },
  ],
};

function normalizedName(value) {
  return canonical(value).replace(/\s+/g, " ");
}

function makePeriod(data = {}) {
  return {
    id: data.id || `period-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    label: data.label || "Reservation",
    service_type: data.service_type || data.service || "Reservation",
    days: Array.isArray(data.days) ? data.days.map(Number) : [0, 1, 2, 3, 4, 5, 6],
    start_time: String(data.start_time || "08:00").substring(0, 5),
    end_time: String(data.end_time || "23:00").substring(0, 5),
    interval_minutes: Number(data.interval_minutes || 30),
    max_reservations_per_slot: Number(data.max_reservations_per_slot || 0),
    slot_capacity: Number(data.slot_capacity || 0),
    min_guests: Number(data.min_guests || 0),
    max_guests: Number(data.max_guests || 0),
    enabled: data.enabled ?? true,
  };
}

function defaultSchedulePeriods(room = {}) {
  const capacity = Number(room.capacity || 0);
  const name = normalizedName(room.display_name || room.name);
  if (name.includes("hanakazu")) {
    return [
      makePeriod({ label: "Lunch", service_type: "À la carte", days: [2, 3, 4, 5, 6, 0], start_time: "11:30", end_time: "14:30", interval_minutes: 30, slot_capacity: capacity || 81 }),
      makePeriod({ label: "Dinner", service_type: "À la carte", days: [2, 3, 4, 5, 6, 0], start_time: "17:30", end_time: "22:00", interval_minutes: 30, slot_capacity: capacity || 81 }),
    ];
  }
  if (name.includes("qsina")) {
    return [
      makePeriod({ label: "Breakfast", service_type: "Breakfast buffet", days: [0, 1, 2, 3, 4, 5, 6], start_time: "06:00", end_time: "10:00", interval_minutes: 30, slot_capacity: capacity || 80 }),
      makePeriod({ label: "Lunch", service_type: "À la carte", days: [1, 2, 6, 0], start_time: "11:30", end_time: "14:30", interval_minutes: 30, slot_capacity: capacity || 80 }),
      makePeriod({ label: "Lunch", service_type: "Light lunch buffet", days: [3, 4, 5], start_time: "11:30", end_time: "14:30", interval_minutes: 30, slot_capacity: capacity || 80 }),
      makePeriod({ label: "Dinner", service_type: "À la carte", days: [1, 2, 3, 4], start_time: "18:00", end_time: "22:00", interval_minutes: 30, slot_capacity: capacity || 80 }),
      makePeriod({ label: "Dinner", service_type: "Dinner buffet", days: [5, 6, 0], start_time: "18:00", end_time: "22:00", interval_minutes: 30, slot_capacity: capacity || 80 }),
    ];
  }
  if (name.includes("phoenix")) {
    return [
      makePeriod({ label: "Lunch", service_type: "Chinese fine dining", days: [0, 1, 2, 3, 4, 5, 6], start_time: "11:00", end_time: "14:30", interval_minutes: 30, slot_capacity: capacity || 250 }),
      makePeriod({ label: "Dinner", service_type: "Chinese fine dining", days: [0, 1, 2, 3, 4, 5, 6], start_time: "18:00", end_time: "22:00", interval_minutes: 30, slot_capacity: capacity || 250 }),
    ];
  }
  return [
    makePeriod({
      label: room.type === "dining" ? "Dining Service" : "Event Window",
      service_type: room.type === "dining" ? "Reservation" : "Function reservation",
      days: [0, 1, 2, 3, 4, 5, 6],
      start_time: room.type === "dining" ? "11:00" : "08:00",
      end_time: room.type === "dining" ? "22:00" : "23:00",
      interval_minutes: room.type === "dining" ? 30 : 60,
      slot_capacity: capacity,
    }),
  ];
}

function normalizeSchedulePeriods(periods, room = {}) {
  const source = Array.isArray(periods) && periods.length ? periods : defaultSchedulePeriods(room);
  return source.map(makePeriod);
}

function makeOverride(data = {}) {
  return {
    id: data.id || `override-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: data.date || "",
    type: data.type || "closed",
    label: data.label || "Manual override",
    start_time: data.start_time || "",
    end_time: data.end_time || "",
    interval_minutes: Number(data.interval_minutes || 30),
    blocked_times_text: Array.isArray(data.blocked_times) ? data.blocked_times.join(", ") : (data.blocked_times_text || ""),
    slot_capacity: Number(data.slot_capacity || 0),
    max_reservations_per_slot: Number(data.max_reservations_per_slot || 0),
    note: data.note || "",
    enabled: data.enabled ?? true,
  };
}

function normalizeScheduleOverrides(overrides) {
  return Array.isArray(overrides) ? overrides.map(makeOverride) : [];
}

function uniqueScheduleOverrides(overrides) {
  const seen = new Set();
  return normalizeScheduleOverrides(overrides).filter((override) => {
    const key = [
      override.type,
      override.date,
      override.start_time,
      override.end_time,
      override.blocked_times_text,
      override.note,
    ].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function legacyAvailabilityOverrides(availability = {}) {
  const blockedDateOverrides = Array.isArray(availability.blocked_dates)
    ? availability.blocked_dates.map((date) => makeOverride({
      date,
      type: "closed",
      label: "Blocked date",
      note: "Migrated from legacy blocked dates",
    }))
    : [];
  const blockedTimeOverrides = availability.blocked_times && typeof availability.blocked_times === "object"
    ? Object.entries(availability.blocked_times).map(([date, times]) => makeOverride({
      date,
      type: "block_time",
      label: "Blocked time",
      blocked_times: Array.isArray(times) ? times : [],
      note: "Migrated from legacy blocked times",
    }))
    : [];
  return [...blockedDateOverrides, ...blockedTimeOverrides];
}

function routeFromSlug(value) {
  const slug = slugify(value);
  return slug ? `/${slug}` : "";
}

function isEarlierTime(start, end) {
  if (!start || !end) return true;
  // Allow overnight / midnight-crossing times (e.g. 17:00 → 01:00).
  // The only invalid case is start === end (handled separately).
  return String(start).substring(0, 5) !== String(end).substring(0, 5);
}

function overrideDefaults(type) {
  const map = {
    closed: { type: "closed", label: "Full-day closure", note: "Closed for this date" },
    block_time: { type: "block_time", label: "Blocked time", start_time: "18:00", end_time: "20:00", note: "Blocked for private use" },
    special_hours: { type: "special_hours", label: "Special hours", start_time: "10:00", end_time: "18:00", note: "Adjusted operating hours" },
    capacity: { type: "capacity", label: "Capacity adjustment", start_time: "08:00", end_time: "23:00", note: "Adjusted capacity for this date" },
  };
  return map[type] || map.closed;
}

function overrideTitle(override) {
  const map = {
    closed: "Full-day closure",
    block_time: "Blocked time range",
    special_hours: "Special opening hours",
    capacity: "Capacity adjustment",
  };
  return override.label || map[override.type] || "Manual override";
}

function overrideSummary(override) {
  if (override.type === "closed") return "Guests cannot reserve this venue for the selected date.";
  if (override.type === "block_time") return "Blocks selected time ranges while keeping the rest of the date available.";
  if (override.type === "special_hours") return "Replaces the normal schedule for one selected date.";
  if (override.type === "capacity") return "Adjusts slot capacity or maximum bookings for one selected date.";
  return "Applies a custom one-day availability rule.";
}

function serializeVenueForm(form, imageFile) {
  return JSON.stringify({
    ...form,
    imageFile: imageFile ? `${imageFile.name}:${imageFile.size}:${imageFile.lastModified}` : "",
  });
}

function previewStatus(form) {
  if (!form.is_visible) {
    return { tone: "neutral", label: "Hidden", message: "This venue will not appear on the guest landing page." };
  }
  if (!form.show_on_landing) {
    return { tone: "gold", label: "Not on landing", message: "This venue is configured but not shown as a main landing card." };
  }
  if (!form.is_active) {
    return { tone: "red", label: "Disabled", message: "This venue is visible but not available for reservation." };
  }
  if (!form.reservations_enabled) {
    return { tone: "red", label: "Unavailable", message: "Guests can see this venue, but reservation access is disabled." };
  }
  return { tone: "green", label: "Guest ready", message: "This venue will appear as a selectable guest landing card." };
}

function blockedTimesToText(blockedTimes) {
  if (!blockedTimes || typeof blockedTimes !== "object") return "";
  return Object.entries(blockedTimes)
    .map(([date, times]) => `${date}: ${(Array.isArray(times) ? times : []).join(", ")}`)
    .join("\n");
}

function parseBlockedTimes(text) {
  return String(text || "")
    .split(/\n+/)
    .reduce((acc, line) => {
      const [date, values] = line.split(":");
      if (!date?.trim() || !values?.trim()) return acc;
      acc[date.trim()] = values.split(",").map((item) => item.trim().substring(0, 5)).filter(Boolean);
      return acc;
    }, {});
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function imageUrl(image) {
  if (!image) return "";
  if (/^(https?:|data:|blob:)/i.test(image)) return image;
  const defaultApiUrl = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" ? "http://localhost:8000/api" : `${window.location.protocol}//${window.location.host}/api`;
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || defaultApiUrl).replace(/\/api\/?$/, "");
  let cleanPath = String(image).replace(/\\/g, "/").replace(/^\/+/, "");

  if (!cleanPath.includes("/")) {
    return `${apiRoot}/images/${cleanPath}`;
  }

  if (cleanPath.startsWith("function-rooms/") && !cleanPath.startsWith("images/")) {
    cleanPath = "images/" + cleanPath;
  }

  return `${apiRoot}/${cleanPath}`;
}

async function compressImageIfNeeded(file, maxDimension = 1200, quality = 0.85) {
  // Only compress files larger than 1.2 MB
  if (file.size <= 1200000) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement("canvas");
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxDimension) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          }
        } else {
          if (height > maxDimension) {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0, width, height);

        // Export to a compressed blob
        const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file); // Fallback to original
              return;
            }
            if (blob.size >= file.size) {
              resolve(file); // If compression didn't save space, keep original
            } else {
              resolve(new File([blob], file.name, {
                type: outputType,
                lastModified: Date.now(),
              }));
            }
          },
          outputType,
          quality
        );
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

function canonical(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9/ ]/g, "")
    .trim();
}

const canonicalParentNames = [
  "alabang function room",
  "laguna ballroom",
  "20/20 function room",
  "grand ballroom",
  "tower ballroom",
  "business center",
];

const childParentNameMap = {
  "laguna ballroom 1": "laguna ballroom",
  "laguna ballroom 2": "laguna ballroom",
  "laguna 1": "laguna ballroom",
  "laguna 2": "laguna ballroom",
  "20/20 function room a": "20/20 function room",
  "20/20 function room b": "20/20 function room",
  "20/20 function room c": "20/20 function room",
  "2020 function room a": "20/20 function room",
  "2020 function room b": "20/20 function room",
  "2020 function room c": "20/20 function room",
  "grand ballroom a": "grand ballroom",
  "grand ballroom b": "grand ballroom",
  "grand ballroom c": "grand ballroom",
  "tower 1": "tower ballroom",
  "tower 2": "tower ballroom",
  "tower 3": "tower ballroom",
};

const diningAliases = {
  "hanakazu": "hanakazu japanese restaurant",
  "hanakazu japanese restaurant": "hanakazu japanese restaurant",
  "hanakazujapaneserestaurant": "hanakazu japanese restaurant",
  "qsina": "qsina restaurant",
  "qsina restaurant": "qsina restaurant",
  "qsinarestaurant": "qsina restaurant",
  "phoenix court": "phoenix court",
  "phoenixcourt": "phoenix court",
};

function isArchivedRoom(room) {
  return Boolean(room?.is_archived || room?.metadata?.archived_reason);
}

function knownParentKey(room) {
  const name = canonical(room?.name);
  const display = canonical(room?.display_name);
  return canonicalParentNames.find((parent) => parent === name || parent === display) || null;
}

function knownChildParentKey(room) {
  const name = canonical(room?.name);
  const display = canonical(room?.display_name);
  return childParentNameMap[name] || childParentNameMap[display] || null;
}

function diningKey(room) {
  if (room?.type !== "dining") return null;
  const name = canonical(room?.name);
  const display = canonical(room?.display_name);
  const slug = canonical(String(room?.slug || "").replace(/-/g, " "));

  return diningAliases[name] || diningAliases[display] || diningAliases[slug] || name || display || slug || null;
}

function childGroupingKey(room, parentName) {
  const display = canonical(room?.display_name);
  const name = canonical(room?.name);
  const value = (display || name)
    .replace(parentName, "")
    .replace(/function room|ballroom/g, "")
    .trim();
  return value || name || String(room?.id || "");
}

function blockedDateList(value) {
  return String(value || "")
    .split(/[,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function availabilityPayload(form) {
  const periods = normalizeSchedulePeriods(form.availability_periods, form)
    .filter((period) => period.start_time && period.end_time)
    .map((period) => ({
      ...period,
      days: period.days.map(Number),
      interval_minutes: Number(period.interval_minutes || 30),
      max_reservations_per_slot: Number(period.max_reservations_per_slot || 0),
      slot_capacity: Number(period.slot_capacity || 0),
      min_guests: Number(period.min_guests || 0),
      max_guests: Number(period.max_guests || 0),
      enabled: Boolean(period.enabled),
    }));
  const overrides = normalizeScheduleOverrides(form.availability_overrides)
    .filter((override) => override.date)
    .map((override) => ({
      ...override,
      blocked_times: String(override.blocked_times_text || "")
        .split(",")
        .map((item) => item.trim().substring(0, 5))
        .filter(Boolean),
      interval_minutes: Number(override.interval_minutes || 30),
      slot_capacity: Number(override.slot_capacity || 0),
      max_reservations_per_slot: Number(override.max_reservations_per_slot || 0),
      enabled: Boolean(override.enabled),
    }));

  return {
    enabled: Boolean(form.availability_enabled),
    days: [0, 1, 2, 3, 4, 5, 6],
    start_time: String(form.availability_start_time || "08:00").substring(0, 5),
    end_time: String(form.availability_end_time || "23:00").substring(0, 5),
    interval_minutes: Number(form.availability_interval_minutes || 60),
    max_reservations_per_slot: Number(form.availability_max_reservations || 0),
    slot_capacity: Number(form.availability_slot_capacity || form.capacity || 0),
    blocked_dates: blockedDateList(form.availability_blocked_dates),
    blocked_times: parseBlockedTimes(form.availability_blocked_times),
    periods,
    overrides,
  };
}

function notifyVenueConfigUpdated() {
  const detail = { source: "function-rooms", updatedAt: Date.now() };
  window.dispatchEvent(new CustomEvent("venue-config-updated", { detail }));
  try {
    localStorage.setItem("venue_config_updated_at", String(detail.updatedAt));
  } catch {
    // Local storage can be blocked in private contexts; the in-tab event still refreshes.
  }
}

function inputStyle(disabled = false) {
  return {
    width: "100%",
    minHeight: 38,
    border: `1px solid ${C.border}`,
    borderRadius: 9,
    background: disabled ? C.soft : C.surface,
    color: disabled ? C.muted : C.text,
    padding: "8px 11px",
    fontFamily: F.body,
    fontSize: 12.5,
    outline: "none",
    cursor: disabled ? "not-allowed" : "text",
    transition: "all 0.16s ease",
  };
}

function buttonBase() {
  return {
    minHeight: 34,
    border: `1px solid ${C.border}`,
    borderRadius: 9,
    background: C.surface,
    color: C.muted,
    padding: "0 11px",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.07em",
    textTransform: "uppercase",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    transition: "background 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.16s ease",
  };
}

function Field({ label, children, hint }) {
  return (
    <label style={{ display: "grid", gap: 6 }}>
      <span style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase", color: C.faint }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 11.5, lineHeight: 1.45, color: C.muted }}>{hint}</span>}
    </label>
  );
}

function Badge({ tone = "neutral", children, compact = false }) {
  const map = {
    green: [C.green, C.greenFaint],
    gold: [C.gold, C.goldFaint],
    red: [C.red, C.redFaint],
    neutral: [C.muted, "rgba(0,0,0,0.035)"],
  };
  const [color, bg] = map[tone] || map.neutral;
  return (
    <span style={{
      display: "inline-flex",
      alignItems: "center",
      borderRadius: 999,
      background: bg,
      color,
      padding: compact ? "3px 6px" : "4px 8px",
      fontSize: compact ? 8.5 : 9,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      {children}
    </span>
  );
}

function MenuAction({ icon: Icon, label, onClick, danger = false }) {
  return (
    <button
      type="button"
      role="menuitem"
      className={`function-room-menu-item${danger ? " is-danger" : ""}`}
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 34,
        border: "none",
        borderRadius: 8,
        background: "transparent",
        color: danger ? C.red : C.muted,
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "0 9px",
        fontFamily: F.body,
        fontSize: 12,
        fontWeight: 600,
        textAlign: "left",
        cursor: "pointer",
        transition: "background 0.16s ease, color 0.16s ease",
      }}
    >
      <Icon size={15} />
      <span>{label}</span>
    </button>
  );
}

function SummaryCard({ icon: Icon, label, value, tone = "gold" }) {
  const color = tone === "green" ? C.green : tone === "red" ? C.red : C.gold;
  const bg = tone === "green" ? C.greenFaint : tone === "red" ? C.redFaint : C.goldFaint;
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: "13px 14px", display: "flex", alignItems: "center", gap: 11 }}>
      <span style={{ width: 32, height: 32, borderRadius: 9, background: bg, color, display: "inline-flex", alignItems: "center", justifyContent: "center" }}><Icon size={16} /></span>
      <div>
        <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint }}>{label}</div>
        <div style={{ marginTop: 2, fontSize: 21, fontWeight: 650, color: C.text }}>{value}</div>
      </div>
    </div>
  );
}

const PAGE_PREVIEW_CARD = { cardHeight: 112, gap: 11, title: 12, chip: 8.5 };

function isChildVenue(room) {
  return Boolean(room?.parent_id || knownChildParentKey(room));
}

function previewImageFor(room, fallback = "") {
  return room?._previewImage || fallback || imageUrl(room?.image);
}

function VenuePreviewCard({ room, preview = "", childRooms = [], highlighted = false, full = false }) {
  const image = previewImageFor(room, preview);
  const isDining = room.type === "dining";
  const isUnavailable = !room.is_active || !room.reservations_enabled;
  const isPublic = room.is_visible && room.show_on_landing;
  const visibleChips = childRooms.slice(0, full ? 5 : 4);
  const title = room.display_name || room.name || "Venue Name";

  return (
    <button
      type="button"
      disabled
      style={{
        width: "100%",
        minHeight: isDining ? undefined : (full ? PAGE_PREVIEW_CARD.cardHeight : 182),
        aspectRatio: isDining ? "4 / 3" : undefined,
        border: highlighted ? "1px solid rgba(201,168,76,0.82)" : "1px solid rgba(255,255,255,0.10)",
        borderRadius: full ? 10 : 13,
        overflow: "hidden",
        position: "relative",
        padding: 0,
        background: "#211A12",
        cursor: "default",
        opacity: isPublic ? 1 : 0.62,
        boxShadow: highlighted ? "0 0 0 2px rgba(201,168,76,0.18), 0 14px 28px rgba(0,0,0,0.24)" : "none",
      }}
    >
      {image ? (
        <img
          src={image}
          alt=""
          draggable={false}
          decoding="async"
          loading="eager"
          style={{
            width: "100%",
            height: "100%",
            position: "absolute",
            inset: 0,
            objectFit: isDining ? "contain" : "cover",
            objectPosition: room.image_position || "center 50%",
            background: isDining ? "#FAF8F5" : "#211A12",
            imageRendering: "auto",
          }}
        />
      ) : (
        <span style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", color: isDining ? "rgba(0,0,0,0.32)" : "rgba(255,255,255,0.32)", background: isDining ? "#FAF8F5" : "#211A12" }}>
          <Camera size={full ? 18 : 30} />
        </span>
      )}
      {!isDining && (
        <span style={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,0.08), rgba(0,0,0,0.62))" }} />
      )}
      {highlighted && (
        <span style={{ position: "absolute", top: 8, left: 8, borderRadius: 999, padding: full ? "3px 6px" : "5px 8px", background: "rgba(201,168,76,0.92)", color: "#17120C", fontSize: full ? 7 : 9, fontWeight: 850, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Editing
        </span>
      )}
      {isUnavailable && (
        <span style={{ position: "absolute", top: full ? 7 : 11, right: full ? 7 : 11, borderRadius: 999, padding: full ? "3px 6px" : "5px 8px", background: "rgba(0,0,0,0.58)", color: "#fff", fontSize: full ? 7 : 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
          Unavailable
        </span>
      )}
      {!isDining && (
        <span style={{ position: "absolute", left: full ? 9 : 14, right: full ? 9 : 14, bottom: full ? 8 : 13, display: "grid", gap: full ? 5 : 8 }}>
          <strong style={{ color: "#fff", fontSize: full ? PAGE_PREVIEW_CARD.title : 18, lineHeight: 1.12, textAlign: "left", textShadow: "0 2px 12px rgba(0,0,0,0.45)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: full ? "nowrap" : "normal" }}>
            {title}
          </strong>
        </span>
      )}
    </button>
  );
}

function VenueLandingPreview({ form, preview, childRooms = [], rooms = [], editingId = null, childrenByParent = new Map(), fullPage = false }) {
  const status = previewStatus(form);
  const statusColor = status.tone === "green" ? C.green : status.tone === "red" ? C.red : C.gold;
  const statusBg = status.tone === "green" ? C.greenFaint : status.tone === "red" ? C.redFaint : C.goldFaint;
  const previewRoom = useMemo(() => ({
    ...form,
    id: editingId || "__draft_preview__",
    _previewImage: preview,
    _isPreviewTarget: true,
  }), [form, editingId, preview]);
  const previewRoomIsChild = isChildVenue(previewRoom);
  const hasDraftContent = Boolean(form.name || form.display_name || preview);

  const pageRooms = useMemo(() => {
    const merged = rooms.map((room) => (editingId && Number(room.id) === Number(editingId) ? previewRoom : room));
    if (!editingId && hasDraftContent && !previewRoomIsChild) merged.push(previewRoom);
    return merged.filter((room) => {
      if (room._isPreviewTarget) return !previewRoomIsChild;
      return !isChildVenue(room) && room.is_active && room.is_visible && room.show_on_landing;
    });
  }, [rooms, editingId, hasDraftContent, previewRoomIsChild, previewRoom]);

  const sectionRooms = (type) => pageRooms
    .filter((room) => (type === "dining" ? room.type === "dining" : room.type !== "dining"))
    .sort(compareRooms("display_order"));

  const getPreviewChildren = (room) => {
    const existing = childrenByParent.get(Number(room.id)) || [];
    if (!previewRoomIsChild) return existing;
    const directParentMatch = form.parent_id && Number(form.parent_id) === Number(room.id);
    const derivedParent = knownChildParentKey(previewRoom);
    const parentKey = knownParentKey(room) || canonical(room.display_name || room.name);
    if (!directParentMatch && (!derivedParent || derivedParent !== parentKey)) return existing;
    const withoutEditing = existing.filter((child) => Number(child.id) !== Number(editingId));
    return [...withoutEditing, previewRoom].sort(compareRooms("display_order"));
  };

  const renderPageSection = (label, title, items) => (
    <div style={{ display: "grid", gap: 6 }}>
      <div>
        <div style={{ color: "#C9A84C", fontSize: 6.8, fontWeight: 850, letterSpacing: "0.22em", textTransform: "uppercase" }}>{label}</div>
        <strong style={{ display: "block", marginTop: 2, color: "#F8F3E8", fontSize: 14, lineHeight: 1.05 }}>{title}</strong>
      </div>
      <div className={title === "Dining Outlets" ? "venue-preview-grid-dining" : "venue-preview-grid-events"}>
        {items.length ? items.map((room) => (
          <VenuePreviewCard
            key={room.id || room.slug || room.name}
            room={room}
            preview={room._isPreviewTarget ? preview : ""}
            childRooms={getPreviewChildren(room)}
            highlighted={Boolean(room._isPreviewTarget)}
            full
          />
        )) : (
          <div style={{ gridColumn: "1 / -1", border: "1px dashed rgba(255,255,255,0.12)", borderRadius: 10, padding: 12, color: "rgba(255,255,255,0.48)", fontSize: 10 }}>
            No visible venues in this section.
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div style={{ display: "grid", gap: 13 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={sectionTitleStyle()}>{fullPage ? "Guest Page Preview" : "Card Preview"}</div>
          <p style={{ margin: "6px 0 0", color: C.muted, fontSize: 12, lineHeight: 1.5 }}>
            {fullPage
              ? "Full customer-facing page context for the selected venue."
              : "Focused card preview for quick edits. Open the Preview tab for the full guest-page context."}
          </p>
        </div>
      </div>

      {!fullPage ? (
        <div style={{ borderRadius: 16, padding: 12, background: "#15110C", border: "1px solid rgba(201,168,76,0.22)", boxShadow: "0 16px 36px rgba(24,20,14,0.18)" }}>
          <VenuePreviewCard room={previewRoom} preview={preview} childRooms={childRooms} highlighted />
        </div>
      ) : (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ color: C.muted, fontSize: 11.5, lineHeight: 1.45 }}>
              Visual reference only. Save changes, then open the customer page for final live verification.
            </span>
          </div>
          <div style={{ borderRadius: 16, padding: 10, background: "#100D09", border: "1px solid rgba(201,168,76,0.22)", boxShadow: "0 16px 36px rgba(24,20,14,0.18)", overflow: "hidden" }}>
            <div className="venue-preview-container" style={{ minHeight: 460, borderRadius: 13, background: "radial-gradient(circle at 18% 14%, rgba(201,168,76,0.12), transparent 34%), #17120C" }}>
              <aside style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.035)", padding: 13, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
                <div>
                  <div style={{ width: 30, height: 30, borderRadius: 9, border: "1px solid rgba(201,168,76,0.34)", color: "#C9A84C", display: "grid", placeItems: "center", fontSize: 14, fontFamily: "serif" }}>B</div>
                  <div style={{ marginTop: 28, color: "#C9A84C", fontSize: 6.8, fontWeight: 850, letterSpacing: "0.2em", textTransform: "uppercase" }}>Concierge Booking</div>
                  <strong style={{ display: "block", marginTop: 8, color: "#FFF8ED", fontSize: 23, lineHeight: 0.98, fontFamily: "Georgia, serif" }}>Seat & Table Reservations</strong>
                  <p style={{ margin: "10px 0 0", color: "rgba(255,255,255,0.68)", fontSize: 8.5, lineHeight: 1.5 }}>
                    A refined reservation gateway for dining outlets, function rooms, and signature hotel venues.
                  </p>
                </div>
                <div style={{ borderTop: "1px solid rgba(255,255,255,0.10)", paddingTop: 12 }}>
                  <strong style={{ color: "#FFF8ED", fontSize: 11, lineHeight: 1.2 }}>Select a venue to begin.</strong>
                  <p style={{ margin: "5px 0 0", color: "rgba(255,255,255,0.58)", fontSize: 7.8, lineHeight: 1.45 }}>Cards remain configurable from Venue Management.</p>
                </div>
              </aside>
              <main style={{ borderRadius: 12, border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.025)", padding: 12, display: "grid", alignContent: "start", gap: 13, minWidth: 0 }}>
                {renderPageSection("Dining Reservation", "Dining Outlets", sectionRooms("dining"))}
                {renderPageSection("Event Reservation", "Events & Function Venues", sectionRooms("function_room"))}
              </main>
            </div>
          </div>
        </div>
      )}

      <div style={{ border: `1px solid ${status.tone === "red" ? "rgba(160,56,56,0.18)" : status.tone === "green" ? "rgba(46,122,90,0.18)" : "rgba(140,107,42,0.18)"}`, borderRadius: 13, padding: 12, background: statusBg }}>
        <strong style={{ display: "block", color: statusColor, fontSize: 11, letterSpacing: "0.09em", textTransform: "uppercase" }}>{status.label}</strong>
        <span style={{ display: "block", marginTop: 5, color: C.muted, fontSize: 12, lineHeight: 1.45 }}>{status.message}</span>
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        {[
          ["Type", form.type === "dining" ? "Dining outlet" : "Function room"],
          ["Route", form.reservation_route || "No route yet"],
          ["Location", form.wing || "Not set"],
          ["Order", String(form.display_order ?? 0)],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12 }}>
            <span style={{ color: C.faint, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
            <span style={{ color: C.text, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis" }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FunctionRooms() {
  const { isDark } = useAdminTheme();
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 960);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 960) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [publishedEvents, setPublishedEvents] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerClosing, setDrawerClosing] = useState(false);
  const [editorTab, setEditorTab] = useState("details");
  const [initialEditorSignature, setInitialEditorSignature] = useState(serializeVenueForm(emptyForm, null));
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [saveFeedback, setSaveFeedback] = useState(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState({ type: "all", status: "all", visibility: "all", wing: "all", landing: "all" });
  const [sortBy, setSortBy] = useState("display_order");
  const [confirmAction, setConfirmAction] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [expandedParents, setExpandedParents] = useState(() => new Set());
  const [pendingLayoutChanges, setPendingLayoutChanges] = useState({});
  const [pendingSettingsChanges, setPendingSettingsChanges] = useState({});
  const [layoutFeedback, setLayoutFeedback] = useState(null);

  // View Modes & Grid config
  const [viewMode, setViewMode] = useState("table"); // "table" | "grid"
  const [gridSection, setGridSection] = useState("dining"); // "dining" | "events"
  const [clientSettings, setClientSettings] = useState({
    dining: { desktop_columns: 6, tablet_columns: 2, mobile_columns: 1 },
    events: { desktop_columns: 3, tablet_columns: 2, mobile_columns: 1 }
  });

  const canManage = authAPI.hasPermission("manage_venues");
  const drawerVisible = drawerOpen || drawerClosing;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );



  const loadRooms = async () => {
    setLoading(true);
    try {
      const [data, settingsRes, eventsRes] = await Promise.all([
        venueAPI.getAll({ include_archived: false, _t: Date.now() }),
        clientDisplayAPI.getAll().catch(() => []),
        eventAPI.getAll().catch(() => [])
      ]);
      setRooms(Array.isArray(data) ? data : []);

      const eventsList = Array.isArray(eventsRes) ? eventsRes : (eventsRes?.data || []);
      setPublishedEvents(eventsList.filter(e => e.status === "published"));

      const newSettings = {
        dining: { desktop_columns: 6, tablet_columns: 2, mobile_columns: 1 },
        events: { desktop_columns: 3, tablet_columns: 2, mobile_columns: 1 }
      };
      if (Array.isArray(settingsRes)) {
        settingsRes.forEach(s => {
          if (newSettings[s.section]) {
            newSettings[s.section] = { ...newSettings[s.section], ...s };
          }
        });
      }
      setClientSettings(newSettings);
    } catch (err) {
      setError(err.message || "Unable to load venue configuration.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadRooms(); }, []);

  // Auto-dismiss toast after 4 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Auto-dismiss validation errors after 5 seconds
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 5000);
    return () => clearTimeout(timer);
  }, [error]);

  const diningParsedVenues = useMemo(() => buildDiningOutletsFromConfig(rooms, { ignoreVisibility: true }), [rooms]);
  const eventParsedVenues = useMemo(() => buildEventVenuesFromConfig(rooms, { ignoreVisibility: true }), [rooms]);

  const diningOrderedVenues = useMemo(() => {
    return [...diningParsedVenues].sort((a, b) => (a._original?.display_order || 0) - (b._original?.display_order || 0));
  }, [diningParsedVenues]);

  const eventOrderedItems = useMemo(() => {
    const venues = eventParsedVenues.map(v => ({
      type: "venue",
      id: v._original?.id,
      title: v.title,
      image: v.image,
      disabled: v.disabled,
      rooms: v.rooms,
      _original: v._original
    }));

    const events = publishedEvents.map(evt => ({
      type: "event",
      id: evt.id,
      title: evt.title,
      image: evt.banner_image || evt.venue?.image,
      disabled: false,
      _original: evt
    }));

    const combined = [...events, ...venues];
    const settings = clientSettings.events || {};
    const orderedIds = settings.ordered_ids || [];

    if (Array.isArray(orderedIds) && orderedIds.length > 0) {
      return [...combined].sort((a, b) => {
        const aKey = `${a.type}:${a.id}`;
        const bKey = `${b.type}:${b.id}`;
        const aIndex = orderedIds.indexOf(aKey);
        const bIndex = orderedIds.indexOf(bKey);

        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
        if (aIndex !== -1) return -1;
        if (bIndex !== -1) return 1;

        if (a.type !== b.type) return a.type === "event" ? -1 : 1;
        if (a.type === "venue") {
          return (a._original?.display_order || 0) - (b._original?.display_order || 0);
        }
        return a.id - b.id;
      });
    }

    return combined.sort((a, b) => {
      if (a.type !== b.type) return a.type === "event" ? -1 : 1;
      if (a.type === "venue") {
        return (a._original?.display_order || 0) - (b._original?.display_order || 0);
      }
      return a.id - b.id;
    });
  }, [eventParsedVenues, publishedEvents, clientSettings.events]);

  const handleGridDragEnd = (event, section) => {
    const { active, over } = event;
    if (!active || !over || active.id === over.id) return;
    if (!canManage) return;

    if (section === "dining") {
      const list = diningOrderedVenues;
      const oldIndex = list.findIndex(v => v.title === active.id);
      const newIndex = list.findIndex(v => v.title === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newArray = arrayMove(list, oldIndex, newIndex);

        const availableSlots = list
          .map(v => v._original?.display_order || 0)
          .sort((a, b) => a - b);

        const updates = [];
        newArray.forEach((item, idx) => {
          const targetOrder = availableSlots[idx];
          if (item._original && item._original.display_order !== targetOrder) {
            updates.push({ id: item._original.id, display_order: targetOrder });
          }
        });

        setRooms(current => current.map(r => {
          const update = updates.find(u => Number(u.id) === Number(r.id));
          return update ? { ...r, display_order: update.display_order } : r;
        }));

        setPendingLayoutChanges(current => {
          const newChanges = { ...current };
          updates.forEach(u => {
            newChanges[u.id] = { ...(newChanges[u.id] || {}), display_order: u.display_order };
          });
          return newChanges;
        });
      }
    } else {
      const list = eventOrderedItems;
      const oldIndex = list.findIndex(item => `${item.type}:${item.id}` === active.id);
      const newIndex = list.findIndex(item => `${item.type}:${item.id}` === over.id);

      if (oldIndex !== -1 && newIndex !== -1) {
        const newArray = arrayMove(list, oldIndex, newIndex);
        const nextOrderedIds = newArray.map(item => `${item.type}:${item.id}`);

        updateClientSetting("events", "ordered_ids", nextOrderedIds);
      }
    }
  };

  const handleGridToggleHide = (id, section) => {
    if (section === "dining") {
      const list = diningOrderedVenues;
      const venue = list.find(v => v.title === id);
      const originalRoom = venue?._original;
      if (!originalRoom || !canManage) return;

      const nextValue = !originalRoom.show_on_landing;

      setRooms(current => current.map(r => Number(r.id) === Number(originalRoom.id) ? { ...r, show_on_landing: nextValue } : r));

      setPendingLayoutChanges(current => ({
        ...current,
        [originalRoom.id]: { ...(current[originalRoom.id] || {}), show_on_landing: nextValue }
      }));
    } else {
      const [type, itemId] = id.split(":");
      if (type === "venue") {
        const originalRoom = rooms.find(r => Number(r.id) === Number(itemId));
        if (!originalRoom || !canManage) return;
        const nextValue = !originalRoom.show_on_landing;

        setRooms(current => current.map(r => Number(r.id) === Number(originalRoom.id) ? { ...r, show_on_landing: nextValue } : r));

        setPendingLayoutChanges(current => ({
          ...current,
          [originalRoom.id]: { ...(current[originalRoom.id] || {}), show_on_landing: nextValue }
        }));
      } else {
        const currentHiddenIds = clientSettings.events?.hidden_ids || [];
        let nextHiddenIds;
        if (currentHiddenIds.includes(id)) {
          nextHiddenIds = currentHiddenIds.filter(hid => hid !== id);
        } else {
          nextHiddenIds = [...currentHiddenIds, id];
        }
        updateClientSetting("events", "hidden_ids", nextHiddenIds);
      }
    }
  };

  const saveLayoutChanges = async () => {
    if (!canManage) return;
    setSaving(true);
    setError("");
    try {
      const promises = [];

      const updates = Object.entries(pendingLayoutChanges).map(([id, changes]) => {
        return venueAPI.update(id, changes);
      });
      promises.push(...updates);

      if (Object.keys(pendingSettingsChanges).length > 0) {
        for (const [section, changes] of Object.entries(pendingSettingsChanges)) {
          const newSettings = clientSettings[section] || {};
          promises.push(clientDisplayAPI.updateSection(section, newSettings));
        }
      }

      await Promise.all(promises);

      setPendingLayoutChanges({});
      setPendingSettingsChanges({});
      await loadRooms();
      notifyVenueConfigUpdated();
      setLayoutFeedback({ type: "save_success" });
    } catch (err) {
      console.error("Failed to save layout changes", err);
      setError("Failed to save layout changes. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const cancelLayoutChanges = () => {
    if (!canManage) return;
    setPendingLayoutChanges({});
    setPendingSettingsChanges({});
    loadRooms(); // Reload to revert optimistic UI state
    setLayoutFeedback({ type: "cancel_success" });
  };

  const updateClientSetting = (section, key, value) => {
    const newSettings = { ...(clientSettings[section] || {}), [key]: value };
    setClientSettings(prev => ({ ...prev, [section]: newSettings }));

    setPendingSettingsChanges(prev => ({
      ...prev,
      [section]: { ...(prev[section] || {}), [key]: value }
    }));
  };

  const handleGridAutoResize = (section) => {
    const list = section === "dining" ? diningOrderedVenues : eventOrderedItems;
    const visibleCount = list.filter(v => {
      if (section === "dining") {
        return v._original ? v._original.show_on_landing : true;
      }
      const itemId = `${v.type}:${v.id}`;
      return v.type === "event"
        ? !(clientSettings.events?.hidden_ids || []).includes(itemId)
        : (v._original ? v._original.show_on_landing : true);
    }).length || list.length;
    let opt = visibleCount;
    if (section === "dining") {
      if (opt > 6) opt = Math.ceil(opt / 2);
    } else {
      if (opt > 4) opt = Math.ceil(opt / 2);
    }
    if (opt < 1) opt = 1;
    updateClientSetting(section, 'desktop_columns', opt);
    setToast(`Grid columns auto-set to ${opt} for ${section === "dining" ? "dining outlets" : "event venues"}.`);
  };

  useEffect(() => {
    if (!drawerVisible || confirmAction || saveFeedback || showDiscardConfirm) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") closeDrawer();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [drawerVisible, confirmAction, saveFeedback, showDiscardConfirm]);

  useEffect(() => {
    if (!confirmAction) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape" && !saving) setConfirmAction(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [confirmAction, saving]);

  useEffect(() => {
    if (!saveFeedback) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setSaveFeedback(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [saveFeedback]);

  useEffect(() => {
    if (!showDiscardConfirm) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setShowDiscardConfirm(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [showDiscardConfirm]);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const closeMenu = () => setOpenMenuId(null);
    const closeMenuOnEscape = (event) => {
      if (event.key === "Escape") setOpenMenuId(null);
    };
    window.addEventListener("click", closeMenu);
    window.addEventListener("keydown", closeMenuOnEscape);
    return () => {
      window.removeEventListener("click", closeMenu);
      window.removeEventListener("keydown", closeMenuOnEscape);
    };
  }, [openMenuId]);

  const uniqueRooms = useMemo(() => {
    const childCounts = new Map();
    const liveRooms = rooms.filter((room) => !isArchivedRoom(room));

    liveRooms.forEach((room) => {
      if (room.parent_id) {
        childCounts.set(Number(room.parent_id), (childCounts.get(Number(room.parent_id)) || 0) + 1);
      }
    });

    const score = (room) =>
      (childCounts.get(Number(room.id)) || 0) * 10 +
      (room.slug ? 4 : 0) +
      (room.reservation_route ? 3 : 0) +
      (room.show_on_landing ? 2 : 0) +
      (room.is_active ? 1 : 0);

    const byKey = new Map();
    liveRooms.forEach((room) => {
      const nameKey = canonical(room.display_name || room.name);
      if (!nameKey) return;
      const diningGroup = diningKey(room);
      const derivedParent = knownChildParentKey(room);
      const parentKey = knownParentKey(room);
      const key = diningGroup
        ? `dining:${diningGroup}`
        : derivedParent
          ? `child:${derivedParent}:${childGroupingKey(room, derivedParent)}`
          : room.parent_id
            ? `child:${room.parent_id}:${nameKey}`
            : `parent:${parentKey || room.slug || nameKey}`;
      const existing = byKey.get(key);
      if (!existing || score(room) >= score(existing)) {
        byKey.set(key, room);
      }
    });

    return Array.from(byKey.values());
  }, [rooms]);

  const isSlugTaken = useMemo(() => {
    if (!form.slug) return false;
    return uniqueRooms.some(
      (room) => String(room.slug || "").toLowerCase() === form.slug.toLowerCase() && (!editing || Number(room.id) !== Number(editing.id))
    );
  }, [form.slug, uniqueRooms, editing]);

  const parentRooms = useMemo(
    () => uniqueRooms.filter((room) => !room.parent_id && !knownChildParentKey(room)),
    [uniqueRooms],
  );
  const childrenByParent = useMemo(() => {
    const map = new Map();
    const parentIdByKey = new Map();

    parentRooms.forEach((room) => {
      const key = knownParentKey(room) || canonical(room.display_name || room.name);
      if (key) parentIdByKey.set(key, Number(room.id));
    });

    uniqueRooms.forEach((room) => {
      const derivedParent = knownChildParentKey(room);
      const parentId = room.parent_id || (derivedParent ? parentIdByKey.get(derivedParent) : null);
      if (!parentId) return;
      const key = Number(parentId);
      map.set(key, [...(map.get(key) || []), room]);
    });
    map.forEach((items, key) => {
      map.set(key, items.sort(compareRooms("display_order")));
    });
    return map;
  }, [uniqueRooms]);

  const duplicateCount = Math.max(0, rooms.filter((room) => !isArchivedRoom(room)).length - uniqueRooms.length);

  const roomMatches = (room, query) => {
    const matchesSearch = !query || [room.name, room.display_name, room.slug, room.wing].some((value) => String(value || "").toLowerCase().includes(query));
    const matchesStatus = filters.status === "all" || (filters.status === "enabled" ? room.is_active : !room.is_active);
    const matchesVisibility = filters.visibility === "all" || (filters.visibility === "visible" ? room.is_visible : !room.is_visible);
    const matchesLanding = filters.landing === "all" || (filters.landing === "shown" ? room.show_on_landing : !room.show_on_landing);
    const matchesWing = filters.wing === "all" || room.wing === filters.wing;
    const matchesType = filters.type === "all"
      || (filters.type === "sub_room" ? Boolean(room.parent_id || knownChildParentKey(room)) : room.type === filters.type);
    return matchesSearch && matchesType && matchesStatus && matchesVisibility && matchesLanding && matchesWing;
  };

  const groupedRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    const parents = parentRooms.sort(compareRooms(sortBy));
    const rows = [];
    const usedChildren = new Set();
    const attachedChildren = new Set();

    parents.forEach((parent) => {
      const children = childrenByParent.get(Number(parent.id)) || [];
      children.forEach((child) => attachedChildren.add(child.id));
      const matchingChildren = children.filter((child) => roomMatches(child, query));
      const parentMatches = roomMatches(parent, query);
      if (!parentMatches && matchingChildren.length === 0) return;

      rows.push({ room: parent, level: 0, childCount: children.length });
      const shouldShowChildren = query || expandedParents.has(Number(parent.id));
      if (!shouldShowChildren) return;
      matchingChildren.forEach((child) => {
        usedChildren.add(child.id);
        rows.push({ room: child, level: 1, childCount: 0, parent });
      });
    });

    uniqueRooms
      .filter((room) => (room.parent_id || knownChildParentKey(room)) && !attachedChildren.has(room.id) && !usedChildren.has(room.id) && roomMatches(room, query))
      .sort(compareRooms(sortBy))
      .forEach((room) => rows.push({ room, level: 1, childCount: 0 }));

    if (sortBy === "parent_first") return rows;
    return rows;
  }, [uniqueRooms, parentRooms, childrenByParent, search, filters, sortBy, expandedParents]);

  const stats = {
    total: uniqueRooms.length,
    dining: uniqueRooms.filter((room) => room.type === "dining").length,
    functionRooms: uniqueRooms.filter((room) => room.type === "function_room").length,
    enabled: uniqueRooms.filter((room) => room.is_active).length,
    visible: uniqueRooms.filter((room) => room.is_visible && room.show_on_landing).length,
    grouped: uniqueRooms.filter((room) => room.parent_id || knownChildParentKey(room)).length,
  };

  const beginCreate = () => {
    setOpenMenuId(null);
    setDrawerClosing(false);
    setEditing(null);
    const draft = { ...emptyForm, availability_periods: defaultSchedulePeriods(emptyForm) };
    setForm(draft);
    setImageFile(null);
    setEditorTab("details");
    setInitialEditorSignature(serializeVenueForm(draft, null));
    setError("");
    setDrawerOpen(true);
  };

  const beginEdit = (room) => {
    setOpenMenuId(null);
    setDrawerClosing(false);
    setEditing(room);
    const draft = normalizeRoom(room);
    setForm(draft);
    setImageFile(null);
    setEditorTab("details");
    setInitialEditorSignature(serializeVenueForm(draft, null));
    setError("");
    setDrawerOpen(true);
  };

  const closeDrawer = (forceDiscard = false) => {
    if (saving && drawerOpen) return;
    if (!drawerOpen) return;
    if (hasUnsavedChanges && !forceDiscard) {
      setShowDiscardConfirm(true);
      return;
    }
    setShowDiscardConfirm(false);
    setDrawerClosing(true);
    setDrawerOpen(false);
    window.setTimeout(() => {
      setDrawerClosing(false);
      setEditing(null);
      setForm(emptyForm);
      setImageFile(null);
      setEditorTab("details");
      setInitialEditorSignature(serializeVenueForm(emptyForm, null));
      setError("");
    }, 280);
  };

  const updateForm = (key, value) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "name" && !editing) {
        next.slug = slugify(value);
        next.display_name = value;
        if (!current.reservation_route || current.reservation_route === routeFromSlug(current.slug)) {
          next.reservation_route = routeFromSlug(value);
        }
      }
      if (key === "slug") {
        const route = routeFromSlug(value);
        if (!current.reservation_route || current.reservation_route === routeFromSlug(current.slug)) {
          next.reservation_route = route;
        }
      }
      if (key === "type") {
        next.category = value === "dining" ? "dining" : "function_room";
        next.wing = value === "dining" ? "Dining" : (current.wing === "Dining" ? "Main Wing" : current.wing);
        next.parent_id = value === "dining" ? "" : current.parent_id;
        next.availability_start_time = value === "dining" ? "11:00" : "08:00";
        next.availability_end_time = value === "dining" ? "22:00" : "23:00";
        next.availability_interval_minutes = value === "dining" ? 30 : 60;
        next.availability_periods = defaultSchedulePeriods({ ...next, type: value });
      }
      return next;
    });
  };

  const applyDefaultSchedule = () => {
    setForm((current) => ({
      ...current,
      availability_periods: defaultSchedulePeriods(current),
    }));
  };

  const setAllAvailabilityFlags = (checked) => {
    setForm((current) => ({
      ...current,
      is_active: checked,
      is_visible: checked,
      show_on_landing: checked,
      reservations_enabled: checked,
    }));
  };

  const addPeriod = () => {
    setForm((current) => ({
      ...current,
      availability_periods: [
        ...normalizeSchedulePeriods(current.availability_periods, current),
        makePeriod({
          label: current.type === "dining" ? "Dining Service" : "Event Window",
          service_type: current.type === "dining" ? "Reservation" : "Function reservation",
          interval_minutes: current.type === "dining" ? 30 : 60,
          slot_capacity: Number(current.capacity || 0),
        }),
      ],
    }));
  };

  const addPresetPeriod = (preset) => {
    setForm((current) => ({
      ...current,
      availability_periods: [
        ...normalizeSchedulePeriods(current.availability_periods, current),
        makePeriod({
          ...preset,
          slot_capacity: Number(current.capacity || preset.slot_capacity || 0),
        }),
      ],
    }));
  };

  const updatePeriod = (periodId, key, value) => {
    setForm((current) => ({
      ...current,
      availability_periods: normalizeSchedulePeriods(current.availability_periods, current).map((period) =>
        period.id === periodId ? { ...period, [key]: value } : period,
      ),
    }));
  };

  const togglePeriodDay = (periodId, dayValue) => {
    const day = Number(dayValue);
    setForm((current) => ({
      ...current,
      availability_periods: normalizeSchedulePeriods(current.availability_periods, current).map((period) => {
        if (period.id !== periodId) return period;
        const days = new Set(period.days.map(Number));
        if (days.has(day)) days.delete(day);
        else days.add(day);
        return { ...period, days: Array.from(days).sort((a, b) => a - b) };
      }),
    }));
  };

  const removePeriod = (periodId) => {
    setForm((current) => ({
      ...current,
      availability_periods: normalizeSchedulePeriods(current.availability_periods, current).filter((period) => period.id !== periodId),
    }));
  };

  const addOverride = (type = "closed") => {
    setForm((current) => ({
      ...current,
      availability_overrides: [...normalizeScheduleOverrides(current.availability_overrides), makeOverride(overrideDefaults(type))],
    }));
  };

  const updateOverride = (overrideId, key, value) => {
    setForm((current) => ({
      ...current,
      availability_overrides: normalizeScheduleOverrides(current.availability_overrides).map((override) =>
        override.id === overrideId
          ? (key === "type"
            ? { ...makeOverride({ ...overrideDefaults(value), id: override.id, date: override.date, enabled: override.enabled }), note: override.note || overrideDefaults(value).note }
            : { ...override, [key]: value })
          : override,
      ),
    }));
  };

  const removeOverride = (overrideId) => {
    setForm((current) => ({
      ...current,
      availability_overrides: normalizeScheduleOverrides(current.availability_overrides).filter((override) => override.id !== overrideId),
    }));
  };

  const validate = (isDraft = false) => {
    if (!form.name.trim()) return "Venue name is required.";

    if (!isDraft) {
      if (!form.slug.trim()) return "Venue slug/code is required.";
      const duplicateSlug = uniqueRooms.find((room) => String(room.slug || "").toLowerCase() === form.slug.toLowerCase() && (!editing || Number(room.id) !== Number(editing.id)));
      if (duplicateSlug) return "Venue slug/code must be unique.";
      if (form.reservation_route && !String(form.reservation_route).startsWith("/")) return "Reservation route must start with /.";
      const duplicateRoute = form.reservation_route
        ? uniqueRooms.find((room) => String(room.reservation_route || "").toLowerCase() === form.reservation_route.toLowerCase() && (!editing || Number(room.id) !== Number(editing.id)))
        : null;
      if (duplicateRoute) return "Reservation route must be unique.";
      if (form.parent_id && editing && String(form.parent_id) === String(editing.id)) return "A venue cannot be assigned as its own parent.";
      if (Number.isNaN(Number(form.display_order))) return "Display order must be numeric.";
      if (Number(form.availability_interval_minutes) < 15) return "Reservation interval must be at least 15 minutes.";
      if (form.availability_start_time && form.availability_end_time && form.availability_start_time === form.availability_end_time) return "Opening and closing time cannot be the same.";

      const periods = normalizeSchedulePeriods(form.availability_periods, form);
      if (periods.length === 0) return "At least one reservation period is required.";
      for (const period of periods) {
        if (!period.days.length) return `${period.label || "A schedule period"} needs at least one day.`;
        if (!period.start_time || !period.end_time) return `${period.label || "A schedule period"} needs start and end times.`;
        if (period.start_time === period.end_time) return `${period.label || "A schedule period"} cannot start and end at the same time.`;
        if (!isEarlierTime(period.start_time, period.end_time)) return `${period.label || "A schedule period"} start and end times cannot be the same.`;
        if (Number(period.interval_minutes) < 15) return `${period.label || "A schedule period"} interval must be at least 15 minutes.`;
      }
      for (const override of normalizeScheduleOverrides(form.availability_overrides)) {
        if (!override.date) return `${overrideTitle(override)} needs a calendar date.`;
        if (["block_time", "special_hours"].includes(override.type)) {
          if (!override.start_time || !override.end_time) return `${overrideTitle(override)} needs start and end times.`;
          if (!isEarlierTime(override.start_time, override.end_time)) return `${overrideTitle(override)} start and end times cannot be the same.`;
        }
        if (override.type === "capacity" && Number(override.slot_capacity || 0) <= 0 && Number(override.max_reservations_per_slot || 0) <= 0) {
          return "Capacity adjustment needs a slot capacity or max bookings value.";
        }
        if (override.type === "capacity" && override.start_time && override.end_time && !isEarlierTime(override.start_time, override.end_time)) {
          return "Capacity adjustment start and end times cannot be the same.";
        }
      }
    }

    if (imageFile && !["image/jpeg", "image/png", "image/webp"].includes(imageFile.type)) return "Image must be JPG, PNG, or WEBP.";
    return "";
  };

  const validateStep = (tabKey) => {
    if (tabKey === "details") {
      if (!form.name.trim()) return "Venue name is required.";
      if (!form.slug.trim()) return "Venue slug/code is required.";
      const duplicateSlug = uniqueRooms.find((room) => String(room.slug || "").toLowerCase() === form.slug.toLowerCase() && (!editing || Number(room.id) !== Number(editing.id)));
      if (duplicateSlug) return "Venue slug/code must be unique.";
      if (form.reservation_route && !String(form.reservation_route).startsWith("/")) return "Reservation route must start with /.";
      const duplicateRoute = form.reservation_route
        ? uniqueRooms.find((room) => String(room.reservation_route || "").toLowerCase() === form.reservation_route.toLowerCase() && (!editing || Number(room.id) !== Number(editing.id)))
        : null;
      if (duplicateRoute) return "Reservation route must be unique.";
      if (form.parent_id && editing && String(form.parent_id) === String(editing.id)) return "A venue cannot be assigned as its own parent.";
      if (Number.isNaN(Number(form.display_order))) return "Display order must be numeric.";
    }

    if (tabKey === "availability") {
      if (Number(form.availability_interval_minutes) < 15) return "Reservation interval must be at least 15 minutes.";
      if (form.availability_start_time && form.availability_end_time && form.availability_start_time === form.availability_end_time) return "Opening and closing time cannot be the same.";
    }

    if (tabKey === "schedule") {
      const periods = normalizeSchedulePeriods(form.availability_periods, form);
      if (periods.length === 0) return "At least one reservation period is required.";
      for (const period of periods) {
        if (!period.days.length) return `${period.label || "A schedule period"} needs at least one day.`;
        if (!period.start_time || !period.end_time) return `${period.label || "A schedule period"} needs start and end times.`;
        if (period.start_time === period.end_time) return `${period.label || "A schedule period"} cannot start and end at the same time.`;
        if (!isEarlierTime(period.start_time, period.end_time)) return `${period.label || "A schedule period"} start and end times cannot be the same.`;
        if (Number(period.interval_minutes) < 15) return `${period.label || "A schedule period"} interval must be at least 15 minutes.`;
      }
    }

    if (tabKey === "exceptions") {
      for (const override of normalizeScheduleOverrides(form.availability_overrides)) {
        if (!override.date) return `${overrideTitle(override)} needs a calendar date.`;
        if (["block_time", "special_hours"].includes(override.type)) {
          if (!override.start_time || !override.end_time) return `${overrideTitle(override)} needs start and end times.`;
          if (!isEarlierTime(override.start_time, override.end_time)) return `${overrideTitle(override)} start and end times cannot be the same.`;
        }
        if (override.type === "capacity" && Number(override.slot_capacity || 0) <= 0 && Number(override.max_reservations_per_slot || 0) <= 0) {
          return "Capacity adjustment needs a slot capacity or max bookings value.";
        }
        if (override.type === "capacity" && override.start_time && override.end_time && !isEarlierTime(override.start_time, override.end_time)) {
          return "Capacity adjustment start and end times cannot be the same.";
        }
      }
    }

    if (imageFile && !["image/jpeg", "image/png", "image/webp"].includes(imageFile.type)) return "Image must be JPG, PNG, or WEBP.";
    return "";
  };

  const handleNextStep = () => {
    const errorMsg = validateStep(editorTab);
    if (errorMsg) {
      setError(errorMsg);
      return;
    }
    setError("");

    const currentIndex = EDITOR_TABS.findIndex(([key]) => key === editorTab);
    if (currentIndex < EDITOR_TABS.length - 1) {
      setEditorTab(EDITOR_TABS[currentIndex + 1][0]);
    }
  };

  const handlePrevStep = () => {
    setError("");
    const currentIndex = EDITOR_TABS.findIndex(([key]) => key === editorTab);
    if (currentIndex > 0) {
      setEditorTab(EDITOR_TABS[currentIndex - 1][0]);
    }
  };

  const requestSaveDraft = (event) => {
    if (event) event.preventDefault();
    if (!canManage) return;
    const validationError = validate(true);
    if (validationError) {
      setError(validationError);
      return;
    }

    setConfirmAction({
      type: "save_draft",
      title: "Save as Draft?",
      message: "Saving as a draft will keep this venue hidden from the client view until you are ready to publish it.",
      label: "Save Draft",
      tone: "green",
    });
  };

  const requestCancelDraft = (event) => {
    if (event) event.preventDefault();
    if (!canManage) return;

    setConfirmAction({
      type: "cancel_draft",
      title: "Delete Draft?",
      message: "Are you sure you want to delete this draft? This action cannot be undone.",
      label: "Delete Draft",
      tone: "red",
    });
  };

  const saveRoom = (event) => {
    if (event) event.preventDefault();
    if (!canManage) return;
    const validationError = validate(false);
    if (validationError) {
      setError(validationError);
      return;
    }

    setConfirmAction({
      type: "save",
      title: editing ? "Save changes?" : "Create venue?",
      message: editing
        ? `Are you sure you want to save the changes made to "${form.display_name || form.name}"?`
        : `Are you sure you want to create the new venue "${form.display_name || form.name}"?`,
      label: editing ? "Save Changes" : "Create Venue",
      tone: "green",
    });
  };

  const createAnotherVenue = () => {
    setSaveFeedback(null);
    const draft = { ...emptyForm, availability_periods: defaultSchedulePeriods(emptyForm) };
    setForm(draft);
    setImageFile(null);
    setEditorTab("details");
    setInitialEditorSignature(serializeVenueForm(draft, null));
    setError("");
  };

  const continueEditingVenue = () => {
    const updatedRoom = uniqueRooms.find((r) => Number(r.id) === Number(editing?.id));
    if (updatedRoom) {
      setEditing(updatedRoom);
      const draft = normalizeRoom(updatedRoom);
      setForm(draft);
      setInitialEditorSignature(serializeVenueForm(draft, null));
    } else {
      setInitialEditorSignature(serializeVenueForm(form, imageFile));
    }
    setSaveFeedback(null);
    setError("");
  };

  const closeSuccessAndDrawer = () => {
    setSaveFeedback(null);
    setDrawerClosing(true);
    setDrawerOpen(false);
    window.setTimeout(() => {
      setDrawerClosing(false);
      setEditing(null);
      setForm(emptyForm);
      setImageFile(null);
      setEditorTab("details");
      setInitialEditorSignature(serializeVenueForm(emptyForm, null));
      setError("");
    }, 280);
  };

  const viewOnGuestPage = () => {
    if (saveFeedback?.reservationRoute) {
      window.open(saveFeedback.reservationRoute, "_blank");
    }
  };

  const isStepCompleted = (key) => {
    if (key === "details") {
      return Boolean(form.name?.trim() && form.slug?.trim());
    }
    if (key === "availability") {
      return true;
    }
    if (key === "schedule") {
      return schedulePeriods.length > 0;
    }
    if (key === "exceptions") {
      return true;
    }
    if (key === "pricing") {
      return true;
    }
    return false;
  };

  const actionCopy = (room, key, nextValue) => {
    const name = room.display_name || room.name || "this venue";
    const venueKind = room.type === "dining" ? "dining outlet" : "function room";
    if (key === "is_active") {
      return nextValue
        ? {
          title: `Enable ${venueKind}?`,
          message: `${name} will be enabled and can be reserved when visibility settings allow it.`,
          label: "Enable",
          tone: "green",
        }
        : {
          title: `Disable ${venueKind}?`,
          message: `${name} will no longer be reservable on the guest-facing venue page. Existing reservations remain preserved.`,
          label: "Disable",
          tone: "red",
        };
    }
    if (key === "is_visible") {
      return nextValue
        ? {
          title: `Show ${venueKind}?`,
          message: `${name} will become eligible to render on the guest-facing venue page when enabled and configured for landing display.`,
          label: "Show",
          tone: "green",
        }
        : {
          title: `Hide ${venueKind}?`,
          message: `${name} will be removed from guest-facing venue lists while remaining manageable in admin.`,
          label: "Hide",
          tone: "red",
        };
    }
    if (key === "reservations_enabled") {
      return nextValue
        ? {
          title: `Enable reservations for ${venueKind}?`,
          message: `${name} will be bookable again when its schedule and capacity allow it.`,
          label: "Enable reservations",
          tone: "green",
        }
        : {
          title: `Disable reservations for ${venueKind}?`,
          message: `${name} may remain visible, but guests will not be able to submit new reservations. Existing reservations stay preserved.`,
          label: "Disable reservations",
          tone: "red",
        };
    }
    return nextValue
      ? {
        title: "Show on landing page?",
        message: `${name} will appear on the venue launcher when it is also enabled and visible.`,
        label: "Show on landing",
        tone: "green",
      }
      : {
        title: "Remove from landing page?",
        message: `${name} will stay in admin but will no longer appear on the venue launcher.`,
        label: "Remove",
        tone: "red",
      };
  };

  const requestToggle = (room, key) => {
    if (!canManage) return;
    setOpenMenuId(null);
    const nextValue = !room[key];
    setConfirmAction({
      type: "toggle",
      room,
      key,
      nextValue,
      ...actionCopy(room, key, nextValue),
    });
  };

  const statePayloadForAction = (action) => {
    if (!action || action.type !== "toggle") return {};
    const payload = { [action.key]: action.nextValue };

    if (action.key === "is_active") {
      if (action.nextValue) {
        payload.reservations_enabled = true;
      } else {
        payload.reservations_enabled = false;
      }
    }

    if (action.key === "is_visible" && !action.nextValue) {
      payload.show_on_landing = false;
    }

    if (action.key === "show_on_landing" && action.nextValue) {
      payload.is_visible = true;
    }

    if (action.key === "reservations_enabled" && action.nextValue) {
      payload.is_active = true;
    }

    return payload;
  };

  const requestDelete = (room) => {
    if (!canManage) return;
    setOpenMenuId(null);
    const name = room.display_name || room.name || "this venue";
    setConfirmAction({
      type: "delete",
      room,
      title: "Delete venue?",
      message: `${name} will be removed from configuration. Use this only for mistaken records; disabling or hiding is safer for historical venues.`,
      label: "Delete",
      tone: "red",
    });
  };

  const runConfirmedAction = async () => {
    if (!confirmAction || !canManage) return;
    setSaving(true);
    setError("");
    try {
      if (confirmAction.type === "delete") {
        await venueAPI.delete(confirmAction.room.id);
        const deletedRoomName = confirmAction.room.display_name || confirmAction.room.name;
        setConfirmAction(null);
        await loadRooms();
        notifyVenueConfigUpdated();
        setSaveFeedback({
          type: "delete",
          venueName: deletedRoomName,
        });
      } else if (confirmAction.type === "save" || confirmAction.type === "save_draft") {
        const isDraft = confirmAction.type === "save_draft";
        const payload = {
          ...form,
          parent_id: form.type === "dining" ? null : (form.parent_id ? Number(form.parent_id) : null),
          category: form.type === "dining" ? "dining" : (form.category || "function_room"),
          capacity: Number(form.capacity || 0),
          display_order: Number(form.display_order || 0),
          display_name: form.display_name || form.name,
          slug: form.slug || slugify(form.name),
          reservation_route: form.reservation_route || routeFromSlug(form.slug || form.name),
          is_draft: isDraft,
          metadata: {
            ...(form.metadata || {}),
            availability: availabilityPayload(form),
          },
        };
        const saved = editing ? await venueAPI.update(editing.id, payload) : await venueAPI.create(payload);
        let finalSaved = saved;
        if (imageFile) {
          const optimizedFile = await compressImageIfNeeded(imageFile);
          finalSaved = await venueAPI.uploadImage(saved.id, optimizedFile);
        }
        await loadRooms();
        notifyVenueConfigUpdated();
        setConfirmAction(null);

        setSaveFeedback({
          type: isDraft ? "draft_saved" : (editing ? "update" : "create"),
          venueName: finalSaved.display_name || finalSaved.name,
          slug: finalSaved.slug,
          reservationRoute: finalSaved.reservation_route,
          venue: finalSaved,
        });
      } else if (confirmAction.type === "cancel_draft") {
        if (editing) {
          await venueAPI.delete(editing.id);
        }
        setConfirmAction(null);
        await loadRooms();
        notifyVenueConfigUpdated();

        setSaveFeedback({
          type: "draft_deleted",
          venueName: editing?.display_name || editing?.name || "Draft",
        });
      } else {
        await venueAPI.update(confirmAction.room.id, statePayloadForAction(confirmAction));
        setConfirmAction(null);
        await loadRooms();
        notifyVenueConfigUpdated();
        setToast("Venue setting updated.");
      }
    } catch (err) {
      const messages = err.data?.errors ? Object.values(err.data.errors).flat().join(" ") : "";
      setError(messages || err.message || "Unable to complete action.");
      setConfirmAction(null);
    } finally {
      setSaving(false);
    }
  };

  const toggleParentExpanded = (roomId) => {
    setExpandedParents((current) => {
      const next = new Set(current);
      if (next.has(Number(roomId))) next.delete(Number(roomId));
      else next.add(Number(roomId));
      return next;
    });
  };

  const preview = imageFile ? URL.createObjectURL(imageFile) : imageUrl(form.image);
  const schedulePeriods = normalizeSchedulePeriods(form.availability_periods, form);
  const scheduleOverrides = normalizeScheduleOverrides(form.availability_overrides);
  const isFullyAvailable = ["is_active", "is_visible", "show_on_landing", "reservations_enabled"].every((key) => Boolean(form[key]));
  const schedulePresets = SCHEDULE_PRESETS[form.type === "dining" ? "dining" : "function_room"];
  const hasUnsavedChanges = drawerVisible && serializeVenueForm(form, imageFile) !== initialEditorSignature;
  const previewChildRooms = editing ? childrenByParent.get(Number(editing.id)) || [] : [];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .function-room-row { transition: background 0.14s ease; }
        .function-room-row:hover { background: rgba(140,107,42,0.032); }
        .function-room-action:hover { border-color: rgba(140,107,42,0.28) !important; color: ${C.gold} !important; transform: translateY(-1px); }
        .function-room-action:disabled { opacity: 0.45; cursor: not-allowed; transform: none !important; }
        .function-room-menu-item:hover { background: rgba(140,107,42,0.07) !important; color: ${C.gold} !important; }
        .function-room-menu-item.is-danger:hover { background: rgba(160,56,56,0.075) !important; color: ${C.red} !important; }
        .function-room-drawer-backdrop {
          opacity: 1;
          transition: opacity 260ms ease, backdrop-filter 260ms ease;
          will-change: opacity;
        }
        .function-room-drawer-backdrop:not(.is-closing) {
          animation: drawerFadeIn 220ms ease both;
        }
        .function-room-drawer {
          opacity: 1;
          transform: translate3d(0,0,0);
          transition: transform 300ms cubic-bezier(0.22,1,0.36,1), opacity 260ms ease;
          will-change: transform, opacity;
          backface-visibility: hidden;
        }
        .function-room-drawer-backdrop:not(.is-closing) .function-room-drawer {
          animation: drawerSlideIn 320ms cubic-bezier(0.22,1,0.36,1) both;
        }
        .function-room-drawer-backdrop.is-closing {
          opacity: 0;
          backdrop-filter: blur(0px) !important;
          pointer-events: none;
        }
        .function-room-drawer-backdrop.is-closing .function-room-drawer {
          opacity: 0;
          transform: translate3d(36px,0,0);
        }
        .function-room-confirm-backdrop { animation: confirmFade 180ms ease both; }
        .function-room-confirm { animation: confirmIn 220ms cubic-bezier(0.22,1,0.36,1) both; }
        .function-room-table {
          min-width: 1040px;
        }
        @keyframes drawerFadeIn { from { opacity: 0; backdrop-filter: blur(0); } to { opacity: 1; backdrop-filter: blur(2px); } }
        @keyframes drawerSlideIn { from { opacity: 0; transform: translate3d(34px,0,0); } to { opacity: 1; transform: translate3d(0,0,0); } }
        @keyframes confirmFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes confirmIn { from { opacity: 0; transform: translateY(8px) scale(0.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes toastSlideDown {
          from { opacity: 0; transform: translate3d(-50%, -16px, 0); }
          to { opacity: 1; transform: translate3d(-50%, 0, 0); }
        }
        .function-room-filters-scroll {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          flex: 1 1 auto;
        }
        .function-room-filters-scroll select {
          flex: 1 1 128px;
          min-width: 128px;
        }
        .function-room-table-wrap {
          overflow-x: auto;
          width: 100%;
          scrollbar-width: thin;
        }

        @media (max-width: 920px) {
          .function-room-stats {
            grid-template-columns: repeat(3, 1fr) !important;
            gap: 10px !important;
          }
          .function-room-toolbar {
            display: flex !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 10px !important;
          }
          .function-room-toolbar > div:first-child {
            width: 100% !important;
          }
          .function-room-filters-scroll {
            display: flex !important;
            overflow-x: auto !important;
            flex-wrap: nowrap !important;
            gap: 8px !important;
            width: 100% !important;
            padding: 4px 0 8px !important;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .function-room-filters-scroll::-webkit-scrollbar {
            display: none;
          }
          .function-room-filters-scroll select {
            flex: 0 0 auto !important;
            width: auto !important;
            min-width: 128px !important;
          }
          .function-room-table-wrap {
            overflow-x: hidden !important;
            width: 100% !important;
          }
          .function-room-table-wrap .function-room-table {
            min-width: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            display: block !important;
            border: none !important;
          }
          .function-room-table-wrap table thead {
            display: none !important;
          }
          .function-room-table-wrap table tbody {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 12px !important;
            width: 100% !important;
          }
          .function-room-table-wrap table tr {
            display: flex !important;
            flex-direction: column !important;
            justify-content: space-between !important;
            gap: 10px !important;
            padding: 16px 18px !important;
            background: ${C.surface} !important;
            border: 1px solid ${C.border} !important;
            border-radius: 12px !important;
            box-shadow: 0 4px 12px rgba(0,0,0,0.02) !important;
            width: 100% !important;
            max-width: 100% !important;
            box-sizing: border-box !important;
          }
          .function-room-table-wrap table td {
            display: block !important;
            width: 100% !important;
            padding: 0 !important;
            border: none !important;
            text-align: left !important;
          }
          .function-room-table-wrap table td:nth-child(2) {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
          }
          .function-room-table-wrap table td:nth-child(2)::before {
            content: "Status" !important;
            font-size: 8px !important;
            font-weight: 800 !important;
            letter-spacing: 0.12em;
            text-transform: uppercase !important;
            color: ${C.faint} !important;
            width: 88px !important;
            margin-right: 12px !important;
            flex-shrink: 0 !important;
          }
          .function-room-table-wrap table td:nth-child(3) {
            display: flex !important;
            align-items: center !important;
            gap: 6px !important;
            flex-wrap: wrap !important;
          }
          .function-room-table-wrap table td:nth-child(3)::before {
            content: "Settings" !important;
            font-size: 8px !important;
            font-weight: 800 !important;
            letter-spacing: 0.12em;
            text-transform: uppercase !important;
            color: ${C.faint} !important;
            width: 88px !important;
            margin-right: 12px !important;
            flex-shrink: 0 !important;
          }
          .function-room-table-wrap table td:nth-child(4) {
            border-top: 1px solid ${C.divider} !important;
            padding-top: 8px !important;
            display: flex !important;
            justify-content: flex-end !important;
          }
          .function-room-table-wrap table td:nth-child(4) > div {
            min-width: auto !important;
            width: 100% !important;
            display: flex !important;
            justify-content: flex-end !important;
          }
          .function-room-drawer { width: 100vw !important; }
          .venue-editor-body { grid-template-columns: 1fr !important; }
          .venue-preview-panel { position: relative !important; top: auto !important; }
          .venue-editor-tabs-scroll {
            overflow-x: auto !important;
            padding-bottom: 8px !important;
            margin-bottom: -6px !important;
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .venue-editor-tabs-scroll::-webkit-scrollbar {
            display: none !important;
          }
        }
        @media (max-width: 640px) {
          .function-room-stats {
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 8px !important;
          }
          .function-room-stats > div:last-child {
            grid-column: span 2 !important;
          }
          .function-room-table-wrap table tbody {
            grid-template-columns: 1fr !important;
          }
        }
        @media (max-width: 1180px) {
          .venue-editor-body { grid-template-columns: 1fr !important; }
          .venue-preview-panel { position: relative !important; top: auto !important; }
        }

        .venue-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
          width: 100%;
        }
        .venue-title-row strong {
          flex: 1;
          min-width: 0;
        }
        @media (max-width: 640px) {
          .venue-title-row {
            flex-wrap: wrap !important;
            gap: 4px 8px !important;
          }
          .venue-title-row strong {
            flex: none !important;
            max-width: 100% !important;
          }
        }

        .venue-preview-container {
          display: grid;
          grid-template-columns: 30% 1fr;
          gap: 12px;
          padding: 14px;
        }
        .venue-preview-grid-dining {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 11px;
        }
        .venue-preview-grid-events {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 11px;
        }

        @media (max-width: 920px) {
          .venue-preview-container {
            grid-template-columns: 1fr !important;
          }
          .venue-preview-grid-dining {
            grid-template-columns: repeat(3, 1fr) !important;
          }
          .venue-preview-grid-events {
            grid-template-columns: repeat(2, 1fr) !important;
          }
        }
        @media (max-width: 640px) {
          .venue-preview-grid-dining {
            grid-template-columns: repeat(2, 1fr) !important;
          }
          .venue-preview-grid-events {
            grid-template-columns: repeat(1, 1fr) !important;
          }
        }
      `}</style>
      <div style={{ display: "flex", height: "100vh", minHeight: 0, overflow: "hidden", background: C.page }}>
        <Sidebar activeNav="function-rooms" isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0, height: "100vh", overflow: "hidden" }}>
          <AdminNavbar />
          <main className="admin-page-content-container">
            <AdminPageHeader
              eyebrow="Venue Configuration"
              title="Venue Management"
              description="Configure dining outlets, function rooms, sub-rooms, photos, visibility, landing display, and reservation availability."
              C={C}
              F={F}
              actions={canManage && (
                <div style={{ display: "flex", gap: 10 }}>
                  <div style={{ display: "flex", background: C.soft, border: `1px solid ${C.border}`, borderRadius: 9, padding: 3 }}>
                    <button type="button" onClick={() => setViewMode("table")} style={{ ...buttonBase(), border: "none", minHeight: 32, padding: "0 12px", background: viewMode === "table" ? C.surface : "transparent", color: viewMode === "table" ? C.text : C.muted, boxShadow: viewMode === "table" ? "0 2px 5px rgba(0,0,0,0.06)" : "none", textTransform: "none", letterSpacing: "normal", fontSize: 13, gap: 6, fontWeight: viewMode === "table" ? 600 : 500 }}>
                      <List size={14} /> List
                    </button>
                    <button type="button" onClick={() => setViewMode("grid")} style={{ ...buttonBase(), border: "none", minHeight: 32, padding: "0 12px", background: viewMode === "grid" ? C.surface : "transparent", color: viewMode === "grid" ? C.text : C.muted, boxShadow: viewMode === "grid" ? "0 2px 5px rgba(0,0,0,0.06)" : "none", textTransform: "none", letterSpacing: "normal", fontSize: 13, gap: 6, fontWeight: viewMode === "grid" ? 600 : 500 }}>
                      <LayoutGrid size={14} /> Landing Display
                    </button>
                  </div>
                  <button type="button" onClick={beginCreate} style={{ ...buttonBase(), minHeight: 40, border: "none", background: C.gold, color: "#fff", padding: "0 14px" }}>
                    <Plus size={14} /> New Venue
                  </button>
                </div>
              )}
            />

            {toast && (
              <div style={{
                marginBottom: 14, padding: "10px 14px", borderRadius: 10,
                background: C.greenFaint, color: C.green,
                border: "1px solid rgba(46,122,90,0.16)", fontSize: 12.5,
                display: "flex", alignItems: "center", gap: 10,
                animation: "toastSlideIn 0.28s ease both",
                fontWeight: 550,
              }}>
                <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1 }}>{toast}</span>
                <button
                  type="button"
                  onClick={() => setToast("")}
                  style={{ background: "none", border: "none", color: C.green, cursor: "pointer", padding: 2, display: "flex", opacity: 0.6 }}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            {error && !drawerOpen && (
              <div style={{
                marginBottom: 14, padding: "10px 14px", borderRadius: 10,
                background: C.redFaint, color: C.red,
                border: "1px solid rgba(160,56,56,0.16)", fontSize: 12.5,
                display: "flex", alignItems: "center", gap: 10,
                fontWeight: 550,
              }}>
                <span style={{ flex: 1 }}>{error}</span>
                <button
                  type="button"
                  onClick={() => setError("")}
                  style={{ background: "none", border: "none", color: C.red, cursor: "pointer", padding: 2, display: "flex", opacity: 0.6 }}
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <style>{`
            @keyframes toastSlideIn {
              from { opacity: 0; transform: translateY(-8px); }
              to { opacity: 1; transform: translateY(0); }
            }
          `}</style>

          <div className="function-room-stats" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 16 }}>
            <SummaryCard icon={Layers} label="Configured Venues" value={stats.total} />
            <SummaryCard icon={Camera} label="Dining Outlets" value={stats.dining} tone="gold" />
            <SummaryCard icon={Layers} label="Function Rooms" value={stats.functionRooms} />
            <SummaryCard icon={CheckCircle2} label="Enabled" value={stats.enabled} tone="green" />
            <SummaryCard icon={Eye} label="Landing Visible" value={stats.visible} tone="gold" />
          </div>

          <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, overflow: "visible" }}>
            {viewMode === "table" ? (
              <>
                <div className="function-room-toolbar" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10, padding: 14, borderBottom: `1px solid ${C.divider}`, background: C.soft, borderTopLeftRadius: 13, borderTopRightRadius: 13 }}>
                  <div style={{ position: "relative", flex: "1 1 240px" }}>
                      <Search size={15} style={{ position: "absolute", left: 11, top: 12, color: C.faint }} />
                      <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search venues, slugs, wings" style={{ ...inputStyle(), paddingLeft: 34 }} />
                    </div>
                    <div className="function-room-filters-scroll">
                      <select value={filters.type} onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))} style={inputStyle()}>
                        <option value="all">All types</option>
                        <option value="dining">Dining outlets</option>
                        <option value="function_room">Function rooms</option>
                        <option value="sub_room">Sub-rooms</option>
                      </select>
                      <select value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))} style={inputStyle()}>
                        <option value="all">All status</option>
                        <option value="enabled">Enabled</option>
                        <option value="disabled">Disabled</option>
                      </select>
                      <select value={filters.visibility} onChange={(e) => setFilters((f) => ({ ...f, visibility: e.target.value }))} style={inputStyle()}>
                        <option value="all">All visibility</option>
                        <option value="visible">Visible</option>
                        <option value="hidden">Hidden</option>
                      </select>
                      <select value={filters.landing} onChange={(e) => setFilters((f) => ({ ...f, landing: e.target.value }))} style={inputStyle()}>
                        <option value="all">All landing</option>
                        <option value="shown">Shown</option>
                        <option value="hidden">Not shown</option>
                      </select>
                      <select value={filters.wing} onChange={(e) => setFilters((f) => ({ ...f, wing: e.target.value }))} style={inputStyle()}>
                        <option value="all">All wings</option>
                        <option value="Dining">Dining</option>
                        <option value="Main Wing">Main Wing</option>
                        <option value="Tower Wing">Tower Wing</option>
                      </select>
                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} style={inputStyle()}>
                        <option value="display_order">Display order</option>
                        <option value="parent_first">Parents first</option>
                        <option value="name">Alphabetical</option>
                        <option value="newest">Newest</option>
                        <option value="oldest">Oldest</option>
                        <option value="status">Enabled first</option>
                      </select>
                    </div>
                  </div>

                  <div className="function-room-table-wrap">
                    <table className="function-room-table" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
                      <thead>
                        <tr style={{ background: C.surface }}>
                          {[
                            { label: "Venue Structure", width: "48%", align: "left" },
                            { label: "Status", width: "12%", align: "left" },
                            { label: "Display Settings", width: "24%", align: "left" },
                            { label: "Manage", width: "16%", align: "right" },
                          ].map((column) => (
                            <th key={column.label} style={{ width: column.width, padding: "11px 14px", textAlign: column.align, color: C.faint, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", borderBottom: `1px solid ${C.divider}` }}>{column.label}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {loading ? (
                          <tr><td colSpan={4} style={{ padding: 22, color: C.muted }}>Loading venues...</td></tr>
                        ) : groupedRows.length === 0 ? (
                          <tr><td colSpan={4} style={{ padding: 22, color: C.muted }}>No venues match the current filters.</td></tr>
                        ) : groupedRows.map(({ room, level, childCount, parent }) => (
                          <tr
                            key={`${room.id}-${level}`}
                            className="function-room-row"
                            style={{
                              background: level ? (isDark ? "rgba(255,255,255,0.03)" : "rgba(250,248,244,0.52)") : C.surface,
                              transition: "background 0.15s ease"
                            }}
                          >
                            <td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.divider}` }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12, paddingLeft: level ? 26 : 0, minWidth: 0, width: "100%" }}>
                                {level ? (
                                  <span style={{ width: 14, color: C.faint, display: "inline-flex", justifyContent: "center" }}><ChevronRight size={14} /></span>
                                ) : childCount ? (
                                  <button
                                    type="button"
                                    onClick={() => toggleParentExpanded(room.id)}
                                    aria-label={`${expandedParents.has(Number(room.id)) ? "Collapse" : "Expand"} ${room.display_name || room.name}`}
                                    style={{ width: 18, height: 18, border: "none", background: "transparent", color: C.gold, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transform: expandedParents.has(Number(room.id)) ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.18s ease" }}
                                  >
                                    <ChevronRight size={15} />
                                  </button>
                                ) : <span style={{ width: 18 }} />}
                                <div style={{ width: level ? 38 : 46, height: level ? 38 : 46, borderRadius: 10, background: room.type === "dining" ? "#15110C" : C.soft, overflow: "hidden", flexShrink: 0, border: `1px solid ${C.border}`, display: "grid", placeItems: "center" }}>
                                  {room.image ? (
                                    <img
                                      src={imageUrl(room.image)}
                                      alt=""
                                      loading="lazy"
                                      decoding="async"
                                      draggable={false}
                                      style={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: room.type === "dining" ? "contain" : "cover",
                                        objectPosition: room.image_position || "center 50%",
                                        imageRendering: "auto",
                                      }}
                                    />
                                  ) : <Camera size={17} style={{ color: C.faint }} />}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <div className="venue-title-row">
                                    <strong style={{ color: C.text, fontSize: level ? 12.5 : 13.5, fontWeight: level ? 560 : 640, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                      <span style={{ color: C.gold, opacity: 0.8, marginRight: 6, fontSize: '0.9em' }}>#{room.id}</span>
                                      {room.display_name || room.name}
                                    </strong>
                                    {!level && (
                                      <Badge tone={room.type === "dining" ? "gold" : "neutral"} compact>
                                        {room.type === "dining" ? "Dining" : childCount ? `${childCount} sub-room${childCount > 1 ? "s" : ""}` : "Function"}
                                      </Badge>
                                    )}
                                  </div>
                                  <div style={{ marginTop: 3, color: C.muted, fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                    {level && parent ? `${parent.display_name || parent.name} · ` : ""}{room.slug || "No slug"} · {room.wing}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.divider}` }}>
                              {room.is_draft ? (
                                <Badge tone="neutral">Draft</Badge>
                              ) : (
                                <Badge tone={room.is_active ? "green" : "red"}>{room.is_active ? "Enabled" : "Disabled"}</Badge>
                              )}
                            </td>
                            <td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.divider}` }}>
                              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                                <Badge tone={room.is_visible ? "green" : "neutral"} compact>{room.is_visible ? "Visible" : "Hidden"}</Badge>
                                <Badge tone={room.show_on_landing ? "gold" : "neutral"} compact>{room.show_on_landing ? "Landing" : "No landing"}</Badge>
                                <Badge tone={room.reservations_enabled ? "green" : "red"} compact>{room.reservations_enabled ? "Reservable" : "Unavailable"}</Badge>
                              </div>
                            </td>
                            <td style={{ padding: "12px 14px", borderBottom: `1px solid ${C.divider}`, textAlign: "right" }}>
                              <div style={{ display: "inline-flex", gap: 8, justifyContent: "flex-end", alignItems: "center", position: "relative", minWidth: 132 }}>
                                <button className="function-room-action" type="button" onClick={() => beginEdit(room)} style={{ ...buttonBase(), minWidth: 84, color: C.gold }} title="Edit venue"><Edit3 size={14} /> Edit</button>
                                <button
                                  className="function-room-action"
                                  type="button"
                                  disabled={!canManage}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    setOpenMenuId((current) => current === room.id ? null : room.id);
                                  }}
                                  style={{ ...buttonBase(), width: 38, minWidth: 38, padding: 0 }}
                                  aria-label={`Open actions for ${room.display_name || room.name}`}
                                  aria-expanded={openMenuId === room.id}
                                >
                                  <MoreHorizontal size={16} />
                                </button>
                                {openMenuId === room.id && (
                                  <div
                                    role="menu"
                                    onClick={(event) => event.stopPropagation()}
                                    style={{ position: "absolute", top: 40, right: 0, zIndex: 20, width: 210, padding: 6, borderRadius: 12, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 18px 46px rgba(24,20,14,0.16)", display: "grid", gap: 2 }}
                                  >
                                    <MenuAction icon={room.is_active ? ToggleRight : ToggleLeft} label={room.is_active ? "Disable venue" : "Enable venue"} onClick={() => requestToggle(room, "is_active")} />
                                    <MenuAction icon={room.is_visible ? EyeOff : Eye} label={room.is_visible ? "Hide from guests" : "Show to guests"} onClick={() => requestToggle(room, "is_visible")} />
                                    <MenuAction icon={room.show_on_landing ? EyeOff : Eye} label={room.show_on_landing ? "Remove from landing" : "Add to landing"} onClick={() => requestToggle(room, "show_on_landing")} />
                                    <MenuAction icon={room.reservations_enabled ? ToggleRight : ToggleLeft} label={room.reservations_enabled ? "Disable reservations" : "Enable reservations"} onClick={() => requestToggle(room, "reservations_enabled")} />
                                    <div style={{ height: 1, background: C.divider, margin: "4px 3px" }} />
                                    <MenuAction icon={Trash2} label="Delete venue" danger onClick={() => requestDelete(room)} />
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              ) : (
                <div style={{ padding: 24, minHeight: 600 }}>
                  {["dining", "events"].map(section => {
                    const title = section === "dining" ? "Dining Outlets" : "Events & Venues";
                    const settings = clientSettings[section] || { desktop_columns: 3 };
                    const list = section === "dining" ? diningOrderedVenues : eventOrderedItems;

                    const visibleList = list.filter(v => {
                      if (section === "dining") {
                        return v._original ? v._original.show_on_landing : true;
                      }
                      const itemId = `${v.type}:${v.id}`;
                      return v.type === "event"
                        ? !(clientSettings.events?.hidden_ids || []).includes(itemId)
                        : (v._original ? v._original.show_on_landing : true);
                    });

                    const hiddenList = list.filter(v => {
                      if (section === "dining") {
                        return v._original ? !v._original.show_on_landing : false;
                      }
                      const itemId = `${v.type}:${v.id}`;
                      return v.type === "event"
                        ? (clientSettings.events?.hidden_ids || []).includes(itemId)
                        : (v._original ? !v._original.show_on_landing : false);
                    });

                    return (
                      <div key={section} style={{ marginBottom: 40 }}>
                        <h2 style={{ fontSize: 18, fontWeight: 700, color: C.text, marginBottom: 20, paddingBottom: 12, borderBottom: `1px solid ${C.divider}` }}>{title}</h2>

                        <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 24 }}>
                          {/* Configuration Sidebar */}
                          <div style={{ background: C.soft, padding: 20, borderRadius: 12, border: `1px solid ${C.border}`, alignSelf: "start" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
                              <Grid size={18} color={C.gold} />
                              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.text }}>Grid Configuration</h3>
                            </div>

                            {section === "dining" ? (
                              <div style={{ padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.border}`, background: C.surface, display: "flex", flexDirection: "column", gap: 12 }}>
                                <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: C.gold }}>Premium Auto-Row</p>
                                <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                                  Dining outlets are automatically displayed in a single horizontal row.
                                </p>
                                <p style={{ margin: 0, fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                                  Visible cards dynamically stretch to fill 100% of the container width without changing height.
                                </p>
                              </div>
                            ) : (
                              <>
                                <div style={{ marginBottom: 24 }}>
                                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                                    <label style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Desktop Columns</label>
                                    <span style={{ fontSize: 12, color: C.muted }}>{settings.desktop_columns} Columns</span>
                                  </div>
                                  <input
                                    type="range"
                                    min="1" max="6"
                                    value={settings.desktop_columns}
                                    onChange={(e) => updateClientSetting(section, 'desktop_columns', parseInt(e.target.value))}
                                    style={{ width: "100%", accentColor: C.gold }}
                                  />
                                </div>

                                <button
                                  onClick={() => handleGridAutoResize(section)}
                                  style={{
                                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                                    width: "100%", padding: "10px", borderRadius: 8,
                                    background: C.goldFaint, color: C.gold,
                                    border: `1px solid rgba(140,107,42,0.2)`,
                                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                                    transition: "background 0.2s"
                                  }}
                                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(140,107,42,0.12)'}
                                  onMouseLeave={e => e.currentTarget.style.background = C.goldFaint}
                                >
                                  <Wand2 size={16} /> Auto Resize Grid
                                </button>
                                <p style={{ fontSize: 11.5, color: C.muted, marginTop: 12, lineHeight: 1.45 }}>
                                  Click to automatically set the ideal number of columns based on how many venues are visible.
                                </p>
                              </>
                            )}
                          </div>

                          {/* Live Preview Area */}
                          <div style={{ background: C.surface, padding: 32, borderRadius: 12, border: `1px solid ${C.border}` }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
                              <Monitor size={18} color={C.muted} />
                              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600, color: C.text }}>Visual Live Preview {section === "dining" && "(Auto-Stretching Row)"}</h3>
                            </div>

                            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={(e) => handleGridDragEnd(e, section)}>
                              <SortableContext items={section === "dining" ? visibleList.map(v => v.title) : visibleList.map(v => `${v.type}:${v.id}`)} strategy={rectSortingStrategy}>
                                <div
                                  className={`reservation-grid reservation-grid--${section === "events" ? "events" : "dining"}`}
                                  style={
                                    section === "dining"
                                      ? {
                                        display: "grid",
                                        gap: "clamp(14px, 1.25vw, 24px)",
                                        gridTemplateColumns: `repeat(var(--dining-cols, 6), minmax(0, 1fr))`,
                                        background: "#fffaf1",
                                        padding: 32,
                                        borderRadius: 16,
                                        border: "1px solid rgba(0,0,0,0.05)",
                                        boxShadow: "inset 0 2px 20px rgba(0,0,0,0.02)",
                                        "--dining-cols": visibleList.length || 1
                                      }
                                      : {
                                        display: "grid",
                                        gap: "clamp(14px, 1.25vw, 24px)",
                                        gridTemplateColumns: `repeat(${settings.desktop_columns}, minmax(0, 1fr))`,
                                        background: "#fffaf1",
                                        padding: 32,
                                        borderRadius: 16,
                                        border: "1px solid rgba(0,0,0,0.05)",
                                        boxShadow: "inset 0 2px 20px rgba(0,0,0,0.02)"
                                      }
                                  }
                                >
                                  {visibleList.map((v) => {
                                    const itemId = section === "dining" ? v.title : `${v.type}:${v.id}`;
                                    return (
                                      <SortableVenueCard
                                        key={itemId}
                                        id={itemId}
                                        item={v}
                                        variant={section === "events" ? "event" : section}
                                        isHidden={false}
                                        onToggleHide={(id) => handleGridToggleHide(id, section)}
                                      />
                                    );
                                  })}
                                </div>
                              </SortableContext>
                            </DndContext>

                            {hiddenList.length > 0 && (
                              <div style={{ marginTop: 24, paddingTop: 24, borderTop: `1px dashed ${C.border}` }}>
                                <h4 style={{ margin: "0 0 16px", fontSize: 13, fontWeight: 600, color: C.muted }}>
                                  Hidden {section === "dining" ? "Dining Outlets" : "Events & Venues"} ({hiddenList.length})
                                </h4>
                                <div style={{ display: "flex", flexWrap: "wrap", gap: 16, opacity: 0.85 }}>
                                  {hiddenList.map((v) => {
                                    const itemId = section === "dining" ? v.title : `${v.type}:${v.id}`;
                                    return (
                                      <div key={itemId} style={{ width: section === "dining" ? 180 : 200, pointerEvents: "auto" }}>
                                        <SortableVenueCard
                                          id={itemId}
                                          item={v}
                                          variant={section === "events" ? "event" : section}
                                          isHidden={true}
                                          onToggleHide={(id) => handleGridToggleHide(id, section)}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <p style={{ fontSize: 12.5, color: C.muted, marginTop: 24, textAlign: "center" }}>
                              Drag and drop the cards above to reorder them. Click "Hide" to toggle visibility.
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {viewMode === "grid" && (
              <style dangerouslySetInnerHTML={{
                __html: `
              .reservation-card {
                position: relative;
                overflow: hidden;
                display: block;
                width: 100%;
                border-radius: 12px;
                background: #17130e;
                text-align: left;
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
                transition: transform 0.2s;
              }
              .reservation-card--dining {
                aspect-ratio: 4 / 3;
                width: var(--card-width, auto);
                max-width: 100%;
                flex-grow: var(--card-stretch, 0);
              }
              .reservation-card--event {
                min-height: 140px;
                aspect-ratio: 1.7 / 1;
                width: var(--card-width, auto);
                max-width: 100%;
                flex-grow: var(--card-stretch, 0);
              }
              .reservation-card__image {
                position: absolute;
                inset: 0;
                width: 100%;
                height: 100%;
                object-fit: cover;
              }
              .reservation-card__shade {
                position: absolute;
                inset: 0;
                background: linear-gradient(180deg, rgba(0,0,0,0.1), rgba(0,0,0,0.7));
              }
              .reservation-card__brand {
                position: absolute;
                inset: 0;
                z-index: 1;
                display: flex;
                align-items: center;
                justify-content: center;
              }
              .reservation-card__logo {
                display: flex;
                align-items: center;
                justify-content: center;
                width: 100%;
                height: 100%;
              }
              .reservation-card__logo img {
                width: 100%;
                height: 100%;
                object-fit: cover;
              }
              .reservation-card__logo span {
                color: #c4a35a;
                font-family: serif;
                font-size: 16px;
                font-weight: 600;
              }
              .reservation-card__meta {
                position: absolute;
                left: 14px;
                right: 14px;
                bottom: 14px;
                z-index: 3;
                display: flex;
                align-items: center;
                justify-content: space-between;
              }
              .reservation-card__title {
                color: #fff;
                font-weight: 600;
                font-size: 14px;
              }
              .reservation-card__rooms {
                display: flex;
                gap: 4px;
              }
              .reservation-card__room {
                background: rgba(0,0,0,0.5);
                color: #fff;
                border: 1px solid rgba(255,255,255,0.2);
                border-radius: 4px;
                padding: 2px 6px;
                font-size: 10px;
              }
              .reservation-card--disabled {
                opacity: 0.5;
              }
              .reservation-card__brand-surface {
                position: absolute;
                inset: 0;
                background: #17130e;
              }
            `}} />
            )}

          </main>
        </div>

        {(Object.keys(pendingLayoutChanges).length > 0 || Object.keys(pendingSettingsChanges).length > 0) && (
          <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 6000, background: C.surface, border: `1px solid ${C.gold}`, borderRadius: 12, padding: "12px 24px", display: "flex", alignItems: "center", gap: 16, boxShadow: "0 12px 40px rgba(201,168,76,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 28, height: 28, borderRadius: "50%", background: "rgba(201,168,76,0.15)", color: C.gold }}>
                <Edit3 size={14} />
              </span>
              <div>
                <strong style={{ color: C.text, fontSize: 14, display: "block" }}>Unsaved Layout Changes</strong>
                <span style={{ color: C.muted, fontSize: 12 }}>You have pending grid reordering or visibility changes.</span>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, paddingLeft: 16, borderLeft: `1px solid ${C.divider}` }}>
              <button type="button" onClick={cancelLayoutChanges} disabled={saving} style={{ ...buttonBase(), background: "transparent", color: C.text, border: `1px solid ${C.border}` }}>
                Cancel
              </button>
              <button type="button" onClick={saveLayoutChanges} disabled={saving} style={{ ...buttonBase(), background: C.gold, color: "#fff", border: "none", minWidth: 120 }}>
                {saving ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        )}

        {drawerVisible && createPortal((
          <DrawerErrorBoundary>
            <div className={`function-room-drawer-backdrop${drawerClosing ? " is-closing" : ""}`} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDrawer(); }} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(24,20,14,0.28)", display: "flex", justifyContent: "flex-end", backdropFilter: "blur(2px)" }}>
              <aside className="function-room-drawer" role="dialog" aria-modal="true" aria-label={editing ? "Edit venue" : "Create venue"} style={{ position: "relative", width: "min(920px, calc(100vw - 28px))", height: "100%", background: C.surface, borderLeft: `1px solid ${C.border}`, boxShadow: "0 24px 70px rgba(24,20,14,0.22)", display: "flex", flexDirection: "column" }}>
                {error && (
                  <div className="drawer-error-toast" style={{
                    position: "absolute",
                    top: 76,
                    left: "50%",
                    transform: "translateX(-50%)",
                    zIndex: 10050,
                    background: "#FEF2F2",
                    border: "1px solid #FCA5A5",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                    borderRadius: 12,
                    padding: "10px 16px",
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "calc(100% - 32px)",
                    maxWidth: 420,
                    color: "#991B1B",
                    fontSize: 12.5,
                    fontWeight: 550,
                    animation: "toastSlideDown 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)",
                  }}>
                    <span style={{ fontSize: 16 }}>⚠️</span>
                    <span style={{ flex: 1, lineHeight: 1.4 }}>{error}</span>
                    <button type="button" onClick={() => setError("")} style={{ background: "none", border: "none", color: "#EF4444", cursor: "pointer", padding: "2px 6px", display: "inline-flex", alignItems: "center" }}><X size={14} /></button>
                  </div>
                )}
                <div style={{ padding: "18px 20px", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14 }}>
                  <div>
                    <div style={{ color: C.gold, fontSize: 8.5, fontWeight: 750, letterSpacing: "0.16em", textTransform: "uppercase" }}>Configuration</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 9, marginTop: 5, flexWrap: "wrap" }}>
                      <h2 style={{ margin: 0, color: C.text, fontSize: 21, lineHeight: 1.15, fontWeight: 640 }}>{editing ? "Edit Venue" : "Create Venue"}</h2>
                      {hasUnsavedChanges && (
                        <span style={{ borderRadius: 999, padding: "4px 8px", background: C.goldFaint, color: C.gold, fontSize: 9, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                          Unsaved changes
                        </span>
                      )}
                    </div>
                  </div>
                  <button type="button" onClick={closeDrawer} style={{ ...buttonBase(), width: 36, padding: 0 }} aria-label="Close panel"><X size={16} /></button>
                </div>

                <form onSubmit={saveRoom} style={{ minHeight: 0, flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>

                  <div style={{ padding: "12px 20px", borderBottom: `1px solid ${C.divider}`, background: C.soft, overflow: "hidden" }}>
                    <div className="venue-editor-tabs-scroll" style={{ display: "flex", alignItems: "center", paddingBottom: 2 }}>
                      {EDITOR_TABS.map(([key, label], index) => {
                        const active = editorTab === key;
                        const completed = isStepCompleted(key);
                        const stepNum = index + 1;
                        const activeIdx = EDITOR_TABS.findIndex(([k]) => k === editorTab) + 1;
                        const isLineActive = activeIdx > index + 1;
                        const nextTab = index + 1 < EDITOR_TABS.length ? EDITOR_TABS[index + 1] : null;
                        const isLineCompleted = completed && nextTab && isStepCompleted(nextTab[0]);
                        const lineBackground = isLineActive
                          ? C.gold
                          : (isLineCompleted ? C.green : "rgba(0,0,0,0.06)");

                        return (
                          <React.Fragment key={key}>
                            <button
                              type="button"
                              onClick={() => setEditorTab(key)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 8,
                                minHeight: 34,
                                border: `1px solid ${active ? C.gold : "rgba(0,0,0,0.06)"}`,
                                borderRadius: 10,
                                background: active ? "linear-gradient(135deg, #FAF6EE, #F4ECE0)" : C.surface,
                                color: active ? C.gold : C.text,
                                padding: "0 14px",
                                fontFamily: F.body,
                                fontSize: 12.5,
                                fontWeight: active ? 700 : 500,
                                cursor: "pointer",
                                transition: "all 0.25s cubic-bezier(0.4, 0, 0.2, 1)",
                                boxShadow: active ? "0 3px 10px rgba(140,107,42,0.11)" : "none",
                                flexShrink: 0,
                                outline: "none",
                              }}
                            >
                              <span style={{
                                width: 18,
                                height: 18,
                                borderRadius: "50%",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 9.5,
                                fontWeight: 800,
                                background: active ? C.gold : (completed ? C.greenFaint : "rgba(0,0,0,0.04)"),
                                color: active ? "#FFF" : (completed ? C.green : C.muted),
                                border: completed && !active ? `1px solid ${C.green}` : "none",
                                transition: "all 0.25s ease",
                              }}>
                                {completed && !active ? "✓" : stepNum}
                              </span>
                              <span style={{ letterSpacing: "0.01em" }}>{label}</span>
                            </button>
                            {index < EDITOR_TABS.length - 1 && (
                              <div
                                style={{
                                  flex: 1,
                                  height: 2,
                                  background: lineBackground,
                                  borderRadius: 2,
                                  margin: "0 10px",
                                  minWidth: 20,
                                  flexShrink: 0,
                                  transition: "background 0.25s ease"
                                }}
                              />
                            )}
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>

                  <div className="venue-editor-body" style={{ flex: 1, overflow: "auto", padding: 20, display: "grid", gridTemplateColumns: editorTab === "preview" ? "minmax(0,1fr)" : "minmax(0,1fr) 300px", gap: 16, alignItems: "start" }}>
                    <div style={{ display: "grid", gap: 16, minWidth: 0 }}>

                      {editorTab === "details" && (
                        <>
                          <section style={formSectionStyle()}>
                            <div style={sectionTitleStyle()}>Display Photo</div>
                            <ImageUploaderCropper
                              value={preview}
                              onChange={(file) => {
                                setImageFile(file);
                                if (file) {
                                  updateForm("image", ""); // Clear string URL if uploading file
                                }
                              }}
                              aspect={16 / 9}
                              title="Venue Image"
                              description="Drag & drop a venue image here or click to upload"
                            />
                            <Field label="Image path or URL (Fallback)">
                              <input value={form.image} onChange={(e) => updateForm("image", e.target.value)} placeholder="Image URL or public image path" style={inputStyle()} disabled={!!imageFile} />
                            </Field>
                          </section>

                          <section style={formSectionStyle()}>
                            <div style={sectionTitleStyle()}>Venue Identity</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                              <Field label="Venue Type">
                                <select value={form.type} onChange={(e) => updateForm("type", e.target.value)} style={inputStyle()}>
                                  <option value="function_room">Function Room</option>
                                  <option value="dining">Dining Outlet</option>
                                </select>
                              </Field>
                              <Field label="Order"><input type="number" min="0" value={form.display_order} onChange={(e) => updateForm("display_order", e.target.value)} style={inputStyle()} /></Field>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                              <Field label="Venue Name"><input value={form.name} onChange={(e) => updateForm("name", e.target.value)} style={inputStyle()} /></Field>
                              <Field label="Customer Display Name"><input value={form.display_name} onChange={(e) => updateForm("display_name", e.target.value)} style={inputStyle()} /></Field>
                            </div>
                            <Field
                              label="Venue Code / Slug"
                              hint="This becomes the venue’s public page URL, such as /potato-corner."
                            >
                              <div style={{ display: "grid", gap: 4 }}>
                                <input value={form.slug} onChange={(e) => updateForm("slug", slugify(e.target.value))} placeholder="hanakazu-japanese-restaurant" style={{ ...inputStyle(), borderColor: isSlugTaken ? C.red : C.border }} />
                                {isSlugTaken && (
                                  <span style={{ color: C.red, fontSize: 11.5, fontWeight: 550, display: "block", marginTop: 2 }}>
                                    ⚠️ This slug is already in use by an active venue.
                                  </span>
                                )}
                                {form.slug && (
                                  <div style={{ marginTop: 4, padding: "5px 8px", borderRadius: 6, background: "rgba(0,0,0,0.025)", border: `1px solid ${isSlugTaken ? "rgba(160,56,56,0.1)" : "rgba(0,0,0,0.04)"}`, display: "inline-flex", alignItems: "center", gap: 6, width: "fit-content" }}>
                                    <span style={{ fontSize: 8, fontWeight: 750, color: C.gold, letterSpacing: "0.06em", textTransform: "uppercase" }}>Public URL</span>
                                    <span style={{ fontSize: 11.5, color: C.text, fontFamily: "monospace" }}>{form.reservation_route || `/${form.slug}`}</span>
                                  </div>
                                )}
                              </div>
                            </Field>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                              <Field label="Location"><select value={form.wing} onChange={(e) => updateForm("wing", e.target.value)} style={inputStyle()}><option>Dining</option><option>Main Wing</option><option>Tower Wing</option></select></Field>
                              <Field label="Capacity"><input type="number" min="0" value={form.capacity} onChange={(e) => updateForm("capacity", e.target.value)} style={inputStyle()} /></Field>
                            </div>
                          </section>

                          <section style={formSectionStyle()}>
                            <div style={sectionTitleStyle()}>Grouping & Reservation</div>
                            <Field label="Parent Room" hint="Leave empty for a main venue. Function-room children become chips under their parent card.">
                              <select disabled={form.type === "dining"} value={form.parent_id} onChange={(e) => updateForm("parent_id", e.target.value)} style={inputStyle(form.type === "dining")}>
                                <option value="">No parent room</option>
                                {parentRooms.filter((room) => room.type === "function_room" && (!editing || room.id !== editing.id)).map((room) => <option key={room.id} value={room.id}>{room.display_name || room.name}</option>)}
                              </select>
                            </Field>
                            {!form.parent_id && form.type === "function_room" && (
                              <>
                                <Field label="Allocation Mode" hint="Configure how subrooms are internally assigned.">
                                  <select
                                    value={form.metadata?.allocation_mode || "admin_assign"}
                                    onChange={(e) => {
                                      const mode = e.target.value;
                                      updateForm("metadata", {
                                        ...form.metadata,
                                        allocation_mode: mode,
                                        requires_admin_assignment: mode === "admin_assign",
                                      });
                                    }}
                                    style={inputStyle()}
                                  >
                                    <option value="admin_assign">Admin Assign after requests</option>
                                    <option value="auto_assign">Auto-Assign Available Subroom</option>
                                    <option value="whole_booking">Whole Parent Booking</option>
                                  </select>
                                </Field>
                                <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: C.text, marginTop: 4, marginBottom: 12 }}>
                                  <span>Requires Admin Assignment</span>
                                  <input
                                    type="checkbox"
                                    checked={Boolean((form.metadata?.allocation_mode || "admin_assign") === "admin_assign")}
                                    disabled
                                    style={{ accentColor: C.gold }}
                                  />
                                </label>
                              </>
                            )}
                            <Field label="Reservation Page Route" hint="Public page opened when guests select this venue. Keep it unique and start with /.">
                              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
                                <input value={form.reservation_route} onChange={(e) => updateForm("reservation_route", e.target.value)} placeholder="/hanakazu-japanese-restaurant" style={inputStyle()} />
                                <button type="button" onClick={() => updateForm("reservation_route", routeFromSlug(form.slug || form.name))} style={{ ...buttonBase(), minHeight: 38 }}>Use slug</button>
                              </div>
                            </Field>
                            <Field label="Description"><textarea value={form.description || ""} onChange={(e) => updateForm("description", e.target.value)} rows={3} style={{ ...inputStyle(), resize: "vertical" }} /></Field>
                          </section>
                        </>
                      )}

                      {editorTab === "availability" && (
                        <section style={formSectionStyle()}>
                          <div style={sectionTitleStyle()}>Availability Settings</div>
                          <label style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 14, padding: 12, border: `1px solid ${isFullyAvailable ? "rgba(140,107,42,0.28)" : C.border}`, borderRadius: 12, background: isFullyAvailable ? C.goldFaint : C.surface }}>
                            <span>
                              <strong style={{ display: "block", color: C.text, fontSize: 12.5, fontWeight: 650 }}>Select all guest availability controls</strong>
                              <span style={{ display: "block", marginTop: 4, color: C.muted, fontSize: 11.5, lineHeight: 1.45 }}>Turns on enabled, visible, landing display, and guest reservation access together.</span>
                            </span>
                            <input type="checkbox" checked={isFullyAvailable} onChange={(e) => setAllAvailabilityFlags(e.target.checked)} style={{ accentColor: C.gold, marginTop: 2 }} />
                          </label>
                          {[
                            ["is_active", "Enabled"],
                            ["is_visible", "Show to Guests"],
                            ["show_on_landing", "Show on landing page"],
                            ["reservations_enabled", "Allow Guest Booking"],
                          ].map(([key, label]) => (
                            <label key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: C.text }}>
                              {label}
                              <input type="checkbox" checked={Boolean(form[key])} onChange={(e) => updateForm(key, e.target.checked)} style={{ accentColor: C.gold }} />
                            </label>
                          ))}
                          {form.type !== "dining" && form.parent_id && (
                            <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: C.text }}>
                              <span>Internal Subroom (Only Admin Assignable)</span>
                              <input type="checkbox" checked={!form.child_selectable} onChange={(e) => updateForm("child_selectable", !e.target.checked)} style={{ accentColor: C.gold }} />
                            </label>
                          )}
                          {form.type !== "dining" && !form.parent_id && (
                            <>
                              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: C.text }}>
                                <span>Parent room selectable</span>
                                <input type="checkbox" checked={Boolean(form.parent_selectable)} onChange={(e) => updateForm("parent_selectable", e.target.checked)} style={{ accentColor: C.gold }} />
                              </label>
                              <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: C.text }}>
                                <span>Child rooms selectable</span>
                                <input type="checkbox" checked={Boolean(form.child_selectable)} onChange={(e) => updateForm("child_selectable", e.target.checked)} style={{ accentColor: C.gold }} />
                              </label>
                            </>
                          )}
                        </section>
                      )}

                      {editorTab === "schedule" && (
                        <section style={formSectionStyle()}>
                          <div style={sectionTitleStyle()}>Reservation Time Rules</div>
                          <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, fontSize: 12.5, color: C.text, padding: "10px 12px", border: `1px solid ${form.availability_enabled ? "rgba(140,107,42,0.28)" : C.border}`, borderRadius: 10, background: form.availability_enabled ? C.goldFaint : C.surface, transition: "all 0.2s ease", cursor: "pointer" }}>
                            <span style={{ fontWeight: 600 }}>Use schedule for guest reservations</span>
                            <input type="checkbox" checked={Boolean(form.availability_enabled)} onChange={(e) => updateForm("availability_enabled", e.target.checked)} style={{ accentColor: C.gold }} />
                          </label>

                          {form.availability_enabled ? (
                            <>
                              <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: "12px 0", borderTop: `1px solid ${C.divider}` }}>
                                <span style={{ color: C.muted, fontSize: 12, lineHeight: 1.5 }}>
                                  Add multiple service periods for breakfast, lunch, dinner, private dining, or event windows.
                                </span>
                                <button type="button" onClick={applyDefaultSchedule} style={{ ...buttonBase(), alignSelf: "flex-start", padding: "8px 14px", border: `1px solid ${C.gold}`, color: C.gold, background: "transparent", transition: "all 0.2s" }} onMouseEnter={e => { e.currentTarget.style.background = C.goldFaint; }} onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}>
                                  Apply Template
                                </button>
                              </div>
                              <div style={{ display: "grid", gap: 7 }}>
                                <span style={{ color: C.faint, fontSize: 8.5, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase" }}>Quick add period</span>
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  {schedulePresets.map((preset) => (
                                    <button key={`${preset.label}-${preset.start_time}`} type="button" onClick={() => addPresetPeriod(preset)} style={{ ...buttonBase(), minHeight: 30 }}>
                                      <Plus size={12} /> {preset.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div style={{ display: "grid", gap: 10 }}>
                                {schedulePeriods.map((period, index) => (
                                  <div key={period.id} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, background: C.soft, display: "grid", gap: 10 }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                      <strong style={{ color: C.text, fontSize: 12.5, fontWeight: 650 }}>Service Period {index + 1}</strong>
                                      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.muted, fontSize: 11.5 }}>
                                          Enabled
                                          <input type="checkbox" checked={Boolean(period.enabled)} onChange={(event) => updatePeriod(period.id, "enabled", event.target.checked)} style={{ accentColor: C.gold }} />
                                        </label>
                                        <button type="button" onClick={() => removePeriod(period.id)} style={{ ...buttonBase(), minHeight: 30, color: C.red }}>Remove</button>
                                      </div>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                      <Field label="Label"><input value={period.label} onChange={(e) => updatePeriod(period.id, "label", e.target.value)} style={inputStyle()} /></Field>
                                      <Field label="Service Type"><input value={period.service_type} onChange={(e) => updatePeriod(period.id, "service_type", e.target.value)} placeholder="Buffet, à la carte, private dining" style={inputStyle()} /></Field>
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 0.75fr", gap: 10 }}>
                                      <Field label="Start"><input type="time" value={period.start_time} onChange={(e) => updatePeriod(period.id, "start_time", e.target.value)} style={inputStyle()} /></Field>
                                      <Field label="End"><input type="time" value={period.end_time} onChange={(e) => updatePeriod(period.id, "end_time", e.target.value)} style={inputStyle()} /></Field>
                                      <Field label="Interval"><input type="number" min="15" step="15" value={period.interval_minutes} onChange={(e) => updatePeriod(period.id, "interval_minutes", e.target.value)} style={inputStyle()} /></Field>
                                    </div>
                                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                      {DAY_OPTIONS.map(([value, label]) => {
                                        const checked = period.days.map(Number).includes(Number(value));
                                        return (
                                          <button
                                            key={`${period.id}-${value}`}
                                            type="button"
                                            onClick={() => togglePeriodDay(period.id, value)}
                                            style={{
                                              minHeight: 28,
                                              borderRadius: 999,
                                              border: checked ? "1px solid rgba(140,107,42,0.34)" : `1px solid ${C.border}`,
                                              background: checked ? C.goldFaint : C.surface,
                                              color: checked ? C.gold : C.muted,
                                              padding: "0 9px",
                                              fontSize: 10,
                                              fontWeight: 700,
                                              cursor: "pointer",
                                            }}
                                          >
                                            {label}
                                          </button>
                                        );
                                      })}
                                    </div>
                                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                                      <Field label="Slot Capacity"><input type="number" min="0" value={period.slot_capacity} onChange={(e) => updatePeriod(period.id, "slot_capacity", e.target.value)} style={inputStyle()} /></Field>
                                      <Field label="Min Guests"><input type="number" min="0" value={period.min_guests} onChange={(e) => updatePeriod(period.id, "min_guests", e.target.value)} style={inputStyle()} /></Field>
                                      <Field label="Max Guests"><input type="number" min="0" value={period.max_guests} onChange={(e) => updatePeriod(period.id, "max_guests", e.target.value)} style={inputStyle()} /></Field>
                                    </div>
                                  </div>
                                ))}
                                <button type="button" onClick={addPeriod} style={{ ...buttonBase(), justifyContent: "center" }}>
                                  <Plus size={14} /> Add service period
                                </button>
                              </div>
                            </>
                          ) : (
                            <div style={{ padding: "20px 14px", textAlign: "center", border: `1px dashed ${C.border}`, borderRadius: 12, background: C.soft, color: C.muted, fontSize: 13, lineHeight: 1.6 }}>
                              🕒 Reservation scheduling is currently disabled. <br />
                              <span style={{ fontSize: 11.5 }}>Tick the checkbox above to enable and configure custom service periods for breakfast, lunch, or dinner.</span>
                            </div>
                          )}
                        </section>
                      )}

                      {editorTab === "exceptions" && (
                        <section style={formSectionStyle()}>
                          <div style={sectionTitleStyle()}>Closures & Blocked Times</div>
                          <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.5 }}>
                            Add calendar-based exceptions for closures, private events, blocked slots, special hours, or one-day capacity changes.
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(0,1fr))", gap: 8 }}>
                            <button type="button" onClick={() => addOverride("closed")} style={{ ...buttonBase(), justifyContent: "center" }}><Plus size={14} /> Closure</button>
                            <button type="button" onClick={() => addOverride("block_time")} style={{ ...buttonBase(), justifyContent: "center" }}><Plus size={14} /> Block time</button>
                            <button type="button" onClick={() => addOverride("special_hours")} style={{ ...buttonBase(), justifyContent: "center" }}><Plus size={14} /> Special hours</button>
                            <button type="button" onClick={() => addOverride("capacity")} style={{ ...buttonBase(), justifyContent: "center" }}><Plus size={14} /> Capacity</button>
                          </div>
                          <div style={{ display: "grid", gap: 10 }}>
                            {scheduleOverrides.map((override, index) => (
                              <div key={override.id} style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, background: C.soft, display: "grid", gap: 10 }}>
                                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                                  <div>
                                    <strong style={{ color: C.text, fontSize: 12.5, fontWeight: 650 }}>{overrideTitle(override)} {index + 1}</strong>
                                    <div style={{ marginTop: 3, color: C.muted, fontSize: 11.5, lineHeight: 1.45 }}>{overrideSummary(override)}</div>
                                  </div>
                                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.muted, fontSize: 11.5 }}>
                                      Active
                                      <input type="checkbox" checked={Boolean(override.enabled)} onChange={(event) => updateOverride(override.id, "enabled", event.target.checked)} style={{ accentColor: C.gold }} />
                                    </label>
                                    <button type="button" onClick={() => removeOverride(override.id)} style={{ ...buttonBase(), minHeight: 30, color: C.red }}>Remove</button>
                                  </div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                  <Field label="Date"><input type="date" value={override.date} onChange={(e) => updateOverride(override.id, "date", e.target.value)} style={inputStyle()} /></Field>
                                  <Field label="Type">
                                    <select value={override.type} onChange={(e) => updateOverride(override.id, "type", e.target.value)} style={inputStyle()}>
                                      <option value="closed">Closed full day</option>
                                      <option value="block_time">Block time range</option>
                                      <option value="special_hours">Special opening hours</option>
                                      <option value="capacity">Capacity adjustment</option>
                                    </select>
                                  </Field>
                                </div>
                                {override.type !== "closed" && (
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <Field label={override.type === "special_hours" ? "Special Open" : "Start"}><input type="time" value={override.start_time} onChange={(e) => updateOverride(override.id, "start_time", e.target.value)} style={inputStyle()} /></Field>
                                    <Field label={override.type === "special_hours" ? "Special Close" : "End"}><input type="time" value={override.end_time} onChange={(e) => updateOverride(override.id, "end_time", e.target.value)} style={inputStyle()} /></Field>
                                  </div>
                                )}
                                {["special_hours", "capacity"].includes(override.type) && (
                                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                                    <Field label="Slot Capacity"><input type="number" min="0" value={override.slot_capacity} onChange={(e) => updateOverride(override.id, "slot_capacity", e.target.value)} style={inputStyle()} /></Field>
                                    <Field label="Max Bookings"><input type="number" min="0" value={override.max_reservations_per_slot} onChange={(e) => updateOverride(override.id, "max_reservations_per_slot", e.target.value)} style={inputStyle()} /></Field>
                                  </div>
                                )}
                                {override.type === "block_time" && (
                                  <Field label="Blocked Slot Times" hint="Optional specific slots inside the range, for example: 18:00, 18:30">
                                    <input value={override.blocked_times_text} onChange={(e) => updateOverride(override.id, "blocked_times_text", e.target.value)} placeholder="18:00, 18:30" style={inputStyle()} />
                                  </Field>
                                )}
                                <Field label="Note"><input value={override.note} onChange={(e) => updateOverride(override.id, "note", e.target.value)} placeholder="Private event, maintenance, holiday closure" style={inputStyle()} /></Field>
                              </div>
                            ))}
                          </div>
                        </section>
                      )}

                      {editorTab === "pricing" && (
                        <>
                          <section style={formSectionStyle()}>
                            <div style={sectionTitleStyle()}>Default Pricing Configuration</div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                              <Field label="Default Pricing Mode">
                                <select
                                  value={form.pricing_mode || ""}
                                  onChange={(e) => updateForm("pricing_mode", e.target.value)}
                                  style={inputStyle()}
                                >
                                  <option value="">None (Custom manually entered pricing)</option>
                                  <option value="fixed">Fixed Flat Rate</option>
                                  <option value="per_person">Per Person Rate</option>
                                  <option value="per_seat">Per Seat Rate</option>
                                  <option value="package">Package / Serving Rate</option>
                                  <option value="custom">Custom Calc</option>
                                </select>
                              </Field>
                              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 15 }}>
                                <input
                                  type="checkbox"
                                  id="show_price_to_guest_default"
                                  checked={form.show_price_to_guest_default || false}
                                  onChange={(e) => updateForm("show_price_to_guest_default", e.target.checked)}
                                  style={{ accentColor: C.gold }}
                                />
                                <label htmlFor="show_price_to_guest_default" style={{ fontFamily: F.body, fontSize: 12.5, color: C.textPrimary, cursor: "pointer" }}>
                                  Show Estimated Price to Guests by Default
                                </label>
                              </div>
                            </div>

                            {form.pricing_mode === "fixed" && (
                              <Field label="Default Base Price (PHP)">
                                <input
                                  type="number"
                                  min="0"
                                  value={form.base_price || ""}
                                  onChange={(e) => updateForm("base_price", e.target.value)}
                                  style={inputStyle()}
                                  placeholder="0.00"
                                />
                              </Field>
                            )}

                            {form.pricing_mode === "per_person" && (
                              <Field label="Default Price Per Person (PHP)">
                                <input
                                  type="number"
                                  min="0"
                                  value={form.price_per_person || ""}
                                  onChange={(e) => updateForm("price_per_person", e.target.value)}
                                  style={inputStyle()}
                                  placeholder="0.00"
                                />
                              </Field>
                            )}

                            {form.pricing_mode === "per_seat" && (
                              <Field label="Default Price Per Seat (PHP)">
                                <input
                                  type="number"
                                  min="0"
                                  value={form.price_per_seat || ""}
                                  onChange={(e) => updateForm("price_per_seat", e.target.value)}
                                  style={inputStyle()}
                                  placeholder="0.00"
                                />
                              </Field>
                            )}
                          </section>

                          <section style={formSectionStyle()}>
                            <div style={sectionTitleStyle()}>Variable Serving / Menu Packages</div>
                            <span style={{ fontSize: 11.5, color: C.textSecondary, fontFamily: F.body, lineHeight: 1.45 }}>
                              Configure variable serving sizes, dining tiers, or event menu packages for this venue. These can be selected on reservations.
                            </span>

                            <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
                              {(form.metadata?.pricing_packages || []).map((pkg, idx) => (
                                <div key={idx} style={{ display: "flex", gap: 8, alignItems: "center", background: C.surfaceInput, padding: "8px 10px", borderRadius: 8, border: `1px solid ${C.borderDefault}` }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: 11, fontWeight: 700, color: C.textPrimary }}>{pkg.name}</div>
                                    <div style={{ fontSize: 10, color: C.textTertiary }}>PHP {Number(pkg.price || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })} ({pkg.type === "per_person" ? "Per Person" : "Flat Rate"})</div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const updatedPkgs = [...(form.metadata?.pricing_packages || [])];
                                      updatedPkgs.splice(idx, 1);
                                      updateForm("metadata", {
                                        ...(form.metadata || {}),
                                        pricing_packages: updatedPkgs,
                                      });
                                    }}
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      color: C.red,
                                      cursor: "pointer",
                                      padding: 4,
                                      display: "flex",
                                      alignItems: "center"
                                    }}
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              ))}

                              {(!form.metadata?.pricing_packages || form.metadata.pricing_packages.length === 0) && (
                                <div style={{ textAlign: "center", padding: "14px 10px", color: C.textTertiary, fontSize: 11.5, fontStyle: "italic", border: `1px dashed ${C.borderDefault}`, borderRadius: 8 }}>
                                  No serving packages configured yet.
                                </div>
                              )}
                            </div>

                            {/* Add Package form row */}
                            <div style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 100px 100px auto",
                              gap: 8,
                              alignItems: "end",
                              marginTop: 10,
                              background: C.surfaceInput,
                              padding: 10,
                              borderRadius: 8,
                              border: `1px dashed ${C.borderDefault}`
                            }}>
                              <label style={{ display: "grid", gap: 4 }}>
                                <span style={{ fontSize: 9, fontWeight: 800, color: C.gold, fontFamily: F.label, textTransform: "uppercase" }}>Package Name</span>
                                <input
                                  type="text"
                                  id="new-pkg-name"
                                  placeholder="e.g. 5-Course Dinner"
                                  style={{ ...inputStyle(), minHeight: 32 }}
                                />
                              </label>
                              <label style={{ display: "grid", gap: 4 }}>
                                <span style={{ fontSize: 9, fontWeight: 800, color: C.gold, fontFamily: F.label, textTransform: "uppercase" }}>Price (PHP)</span>
                                <input
                                  type="number"
                                  id="new-pkg-price"
                                  min="0"
                                  placeholder="0.00"
                                  style={{ ...inputStyle(), minHeight: 32 }}
                                />
                              </label>
                              <label style={{ display: "grid", gap: 4 }}>
                                <span style={{ fontSize: 9, fontWeight: 800, color: C.gold, fontFamily: F.label, textTransform: "uppercase" }}>Charge Type</span>
                                <select
                                  id="new-pkg-type"
                                  style={{ ...inputStyle(), minHeight: 32 }}
                                >
                                  <option value="per_person">Per Person</option>
                                  <option value="flat">Flat Rate</option>
                                </select>
                              </label>
                              <button
                                type="button"
                                onClick={() => {
                                  const nameEl = document.getElementById("new-pkg-name");
                                  const priceEl = document.getElementById("new-pkg-price");
                                  const typeEl = document.getElementById("new-pkg-type");
                                  if (nameEl && priceEl && typeEl && nameEl.value.trim()) {
                                    const newPkg = {
                                      name: nameEl.value.trim(),
                                      price: Number(priceEl.value || 0),
                                      type: typeEl.value,
                                    };
                                    const updatedPkgs = [...(form.metadata?.pricing_packages || []), newPkg];
                                    updateForm("metadata", {
                                      ...(form.metadata || {}),
                                      pricing_packages: updatedPkgs,
                                    });
                                    nameEl.value = "";
                                    priceEl.value = "";
                                    typeEl.value = "per_person";
                                  } else {
                                    alert("Please fill in the package name and price.");
                                  }
                                }}
                                style={{
                                  ...buttonBase(),
                                  background: C.gold,
                                  color: "#FFF",
                                  border: "none",
                                  minHeight: 32,
                                  cursor: "pointer",
                                  padding: "0 14px"
                                }}
                              >
                                Add
                              </button>
                            </div>
                          </section>
                        </>
                      )}

                      {editorTab === "preview" && (
                        <section style={formSectionStyle()}>
                          <VenueLandingPreview
                            form={form}
                            preview={preview}
                            childRooms={previewChildRooms}
                            rooms={uniqueRooms}
                            editingId={editing?.id}
                            childrenByParent={childrenByParent}
                            fullPage
                          />
                        </section>
                      )}
                    </div>

                    <aside className="venue-preview-panel" style={{ position: "sticky", top: 0, alignSelf: "start", display: editorTab === "preview" ? "none" : "grid", gap: 12 }}>
                      <VenueLandingPreview
                        form={form}
                        preview={preview}
                        childRooms={previewChildRooms}
                        rooms={uniqueRooms}
                        editingId={editing?.id}
                        childrenByParent={childrenByParent}
                      />
                    </aside>
                  </div>

                  <div style={{ padding: "14px 20px", borderTop: `1px solid ${C.divider}`, background: C.soft, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 9 }}>
                    <div style={{ display: "flex", gap: 8, flex: 1 }} />
                    <div style={{ display: "flex", gap: 9, flexShrink: 0 }}>
                      <button type="button" onClick={closeDrawer} disabled={saving} style={buttonBase()}>Cancel</button>

                      {form.is_draft && editing && (
                        <button type="button" onClick={requestCancelDraft} disabled={saving} style={{ ...buttonBase(), background: C.redFaint, color: C.red, border: "none" }}>
                          Delete Draft
                        </button>
                      )}

                      {(!editing || form.is_draft) && (
                        <button type="button" onClick={requestSaveDraft} disabled={!canManage || saving} style={{ ...buttonBase(), background: C.soft, color: C.text, border: `1px solid ${C.border}` }}>
                          {saving ? "Saving..." : "Save Draft"}
                        </button>
                      )}

                      {editorTab !== "details" && (
                        <button type="button" onClick={handlePrevStep} disabled={saving} style={{ ...buttonBase(), background: C.soft, color: C.text, border: `1px solid ${C.border}` }}>
                          Back
                        </button>
                      )}

                      {editorTab !== "preview" ? (
                        <button type="button" onClick={handleNextStep} disabled={saving} style={{ ...buttonBase(), minWidth: 100, border: "none", background: C.gold, color: "#fff" }}>
                          Next
                        </button>
                      ) : (
                        <button type="submit" disabled={!canManage || saving} style={{ ...buttonBase(), minWidth: 150, border: "none", background: canManage ? C.gold : C.faint, color: "#fff", cursor: canManage && !saving ? "pointer" : "not-allowed" }}>
                          {saving ? "Working..." : editing && !form.is_draft ? "Save Changes" : "Publish Venue"}
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </aside>
            </div>
          </DrawerErrorBoundary>
        ), document.body)}

        {confirmAction && (
          <div className="function-room-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setConfirmAction(null); }} style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", padding: 18, background: "rgba(24,20,14,0.34)", backdropFilter: "blur(3px)" }}>
            <section className="function-room-confirm" role="dialog" aria-modal="true" aria-labelledby="function-room-confirm-title" style={{ width: "min(420px, 100%)", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 26px 70px rgba(24,20,14,0.24)", padding: 20 }}>
              <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                <span style={{ width: 38, height: 38, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: confirmAction.tone === "red" ? C.redFaint : C.greenFaint, color: confirmAction.tone === "red" ? C.red : C.green }}>
                  {confirmAction.tone === "red" ? <Trash2 size={18} /> : <CheckCircle2 size={18} />}
                </span>
                <div>
                  <h2 id="function-room-confirm-title" style={{ margin: 0, fontSize: 18, lineHeight: 1.25, color: C.text, fontWeight: 650 }}>{confirmAction.title}</h2>
                  <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, color: C.muted }}>{confirmAction.message}</p>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 18 }}>
                <button type="button" disabled={saving} onClick={() => setConfirmAction(null)} style={buttonBase()}>Cancel</button>
                <button type="button" disabled={saving} onClick={runConfirmedAction} style={{ ...buttonBase(), minWidth: 118, border: "none", background: confirmAction.tone === "red" ? C.red : C.green, color: "#fff" }}>
                  {saving ? "Working..." : confirmAction.label}
                </button>
              </div>
            </section>
          </div>
        )}

        {showDiscardConfirm && (
          <div className="function-room-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowDiscardConfirm(false); }} style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", padding: 18, background: "rgba(24,20,14,0.34)", backdropFilter: "blur(3px)" }}>
            <section className="function-room-confirm" role="dialog" aria-modal="true" aria-labelledby="discard-changes-title" style={{ width: "min(420px, 100%)", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 26px 70px rgba(24,20,14,0.24)", padding: 20 }}>
              <div style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                <span style={{ width: 38, height: 38, borderRadius: 12, display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, background: C.redFaint, color: C.red }}>
                  <AlertTriangle size={18} />
                </span>
                <div>
                  <h2 id="discard-changes-title" style={{ margin: 0, fontSize: 18, lineHeight: 1.25, color: C.text, fontWeight: 650 }}>Discard unsaved changes?</h2>
                  <p style={{ margin: "8px 0 0", fontSize: 13, lineHeight: 1.6, color: C.muted }}>You have unsaved venue configuration changes. Leaving now will discard them.</p>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 9, marginTop: 18 }}>
                <button type="button" onClick={() => setShowDiscardConfirm(false)} style={buttonBase()}>Keep Editing</button>
                <button type="button" onClick={() => closeDrawer(true)} style={{ ...buttonBase(), minWidth: 140, border: "none", background: C.gold, color: "#fff" }}>
                  Discard Changes
                </button>
              </div>
            </section>
          </div>
        )}

        {layoutFeedback && (
          <div className="function-room-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLayoutFeedback(null); }} style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", padding: 18, background: "rgba(24,20,14,0.34)", backdropFilter: "blur(3px)" }}>
            <section className="function-room-confirm" role="dialog" aria-modal="true" aria-labelledby="layout-feedback-title" style={{ width: "min(420px, 100%)", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 24px 60px rgba(24,20,14,0.18)", padding: "26px 28px", textAlign: "center" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <span style={{ width: 44, height: 44, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: layoutFeedback.type === "save_success" ? "linear-gradient(135deg, rgba(46,122,90,0.08), rgba(46,122,90,0.15))" : "rgba(255,255,255,0.05)", color: layoutFeedback.type === "save_success" ? C.green : C.text }}>
                  {layoutFeedback.type === "save_success" ? <CheckCircle2 size={24} /> : <RotateCcw size={22} />}
                </span>
                <div>
                  <h2 id="layout-feedback-title" style={{ margin: 0, fontSize: 18, lineHeight: 1.25, color: C.text, fontWeight: 700, fontFamily: F.label, letterSpacing: "-0.01em" }}>
                    {layoutFeedback.type === "save_success" ? "Layout Saved" : "Layout Restored"}
                  </h2>
                  <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.5, color: C.muted }}>
                    {layoutFeedback.type === "save_success"
                      ? "Your grid reordering and visibility changes have been successfully saved."
                      : "Your unsaved layout changes have been discarded, and the original layout has been restored."}
                  </p>
                </div>
              </div>
              <button type="button" onClick={() => setLayoutFeedback(null)} style={{ ...buttonBase(), width: "100%", marginTop: 22, background: C.soft, border: `1px solid ${C.border}`, color: C.text }}>
                Close
              </button>
            </section>
          </div>
        )}

        {saveFeedback && (
          <div className="function-room-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeSuccessAndDrawer(); }} style={{ position: "fixed", inset: 0, zIndex: 10000, display: "grid", placeItems: "center", padding: 18, background: "rgba(24,20,14,0.34)", backdropFilter: "blur(3px)" }}>
            <section className="function-room-confirm" role="dialog" aria-modal="true" aria-labelledby="save-feedback-title" style={{ width: "min(460px, 100%)", borderRadius: 14, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 24px 60px rgba(24,20,14,0.18)", padding: "26px 28px" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", gap: 12 }}>
                <span style={{ width: 44, height: 44, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", background: (saveFeedback.type === "delete" || saveFeedback.type === "draft_deleted") ? "linear-gradient(135deg, rgba(160,56,56,0.08), rgba(160,56,56,0.15))" : "linear-gradient(135deg, rgba(46,122,90,0.08), rgba(46,122,90,0.15))", color: (saveFeedback.type === "delete" || saveFeedback.type === "draft_deleted") ? C.red : C.green }}>
                  {(saveFeedback.type === "delete" || saveFeedback.type === "draft_deleted") ? <Trash2 size={24} /> : <CheckCircle2 size={24} />}
                </span>
                <div>
                  <h2 id="save-feedback-title" style={{ margin: 0, fontSize: 18, lineHeight: 1.25, color: C.text, fontWeight: 700, fontFamily: F.label, letterSpacing: "-0.01em" }}>
                    {saveFeedback.type === "create" ? "Venue Created"
                      : saveFeedback.type === "update" ? "Venue Updated"
                        : saveFeedback.type === "draft_saved" ? "Draft Saved"
                          : saveFeedback.type === "delete" ? "Venue Deleted"
                            : "Draft Deleted"}
                  </h2>
                  <p style={{ margin: "6px 0 0", fontSize: 12.5, lineHeight: 1.5, color: C.muted }}>
                    {saveFeedback.type === "draft_saved"
                      ? "Your draft has been saved. It is hidden from the client view until you publish it."
                      : saveFeedback.type === "draft_deleted" || saveFeedback.type === "delete"
                        ? "The venue has been completely removed from the system."
                        : "Changes have been saved successfully and are now reflected in the venue directory."}
                  </p>
                </div>
              </div>

              {saveFeedback.type !== "delete" && saveFeedback.type !== "draft_deleted" && (
                <div style={{ marginTop: 22, display: "grid", gap: 14, padding: "16px 0", borderTop: `1px solid ${C.divider}`, borderBottom: `1px solid ${C.divider}` }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px 20px" }}>
                    <div>
                      <span style={{ display: "block", fontSize: 8.5, fontWeight: 750, color: C.gold, letterSpacing: "0.08em", textTransform: "uppercase" }}>Venue Name</span>
                      <strong style={{ display: "block", marginTop: 3, color: C.text, fontSize: 12.5, fontWeight: 650 }}>{saveFeedback.venueName}</strong>
                    </div>

                    <div>
                      <span style={{ display: "block", fontSize: 8.5, fontWeight: 750, color: C.gold, letterSpacing: "0.08em", textTransform: "uppercase" }}>Venue Type</span>
                      <span style={{ display: "block", marginTop: 3, color: C.muted, fontSize: 12.5 }}>{form.type === "dining" ? "Dining Outlet" : "Function Room"}</span>
                    </div>

                    <div>
                      <span style={{ display: "block", fontSize: 8.5, fontWeight: 750, color: C.gold, letterSpacing: "0.08em", textTransform: "uppercase" }}>Location Wing</span>
                      <span style={{ display: "block", marginTop: 3, color: C.muted, fontSize: 12.5 }}>{form.wing || "Main Wing"}</span>
                    </div>

                    <div>
                      <span style={{ display: "block", fontSize: 8.5, fontWeight: 750, color: C.gold, letterSpacing: "0.08em", textTransform: "uppercase" }}>Status</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, marginTop: 4 }}>
                        <span style={{ width: 6, height: 6, borderRadius: "50%", background: form.is_active ? C.green : C.red }} />
                        <span style={{ color: C.text, fontSize: 12.5, fontWeight: 600 }}>{form.is_active ? "Enabled" : "Disabled"}</span>
                      </span>
                    </div>

                    <div style={{ gridColumn: "1 / -1" }}>
                      <span style={{ display: "block", fontSize: 8.5, fontWeight: 750, color: C.gold, letterSpacing: "0.08em", textTransform: "uppercase" }}>Public URL Route</span>
                      <span style={{ display: "block", marginTop: 3, color: C.text, fontFamily: "monospace", fontSize: 11.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {saveFeedback.reservationRoute || `/${saveFeedback.slug}`}
                      </span>
                    </div>

                    <div>
                      <span style={{ display: "block", fontSize: 8.5, fontWeight: 750, color: C.gold, letterSpacing: "0.08em", textTransform: "uppercase" }}>Visibility</span>
                      <span style={{ display: "block", marginTop: 3, color: C.muted, fontSize: 12.5 }}>{form.is_visible ? "Visible to guests" : "Hidden in concierge"}</span>
                    </div>

                    <div>
                      <span style={{ display: "block", fontSize: 8.5, fontWeight: 750, color: C.gold, letterSpacing: "0.08em", textTransform: "uppercase" }}>Schedule periods</span>
                      <span style={{ display: "block", marginTop: 3, color: C.muted, fontSize: 12.5 }}>{schedulePeriods.length} active service(s)</span>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 22 }}>
                <button
                  type="button"
                  onClick={closeSuccessAndDrawer}
                  style={{
                    ...buttonBase(),
                    minHeight: 38,
                    border: "none",
                    background: C.gold,
                    color: "#fff",
                    width: "100%",
                    fontSize: 11.5,
                    fontWeight: 700,
                    letterSpacing: "0.05em",
                    boxShadow: "0 2px 8px rgba(140, 107, 42, 0.15)",
                    justifyContent: "center",
                  }}
                >
                  Done
                </button>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                  {saveFeedback.type === "create" ? (
                    <button
                      type="button"
                      onClick={createAnotherVenue}
                      style={{
                        ...buttonBase(),
                        minHeight: 36,
                        borderColor: "rgba(0,0,0,0.12)",
                        background: C.surface,
                        color: C.text,
                        fontSize: 11,
                        fontWeight: 650,
                        justifyContent: "center",
                      }}
                    >
                      <Plus size={13} /> Create Another
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={continueEditingVenue}
                      style={{
                        ...buttonBase(),
                        minHeight: 36,
                        borderColor: "rgba(0,0,0,0.12)",
                        background: C.surface,
                        color: C.text,
                        fontSize: 11,
                        fontWeight: 650,
                        justifyContent: "center",
                      }}
                    >
                      <Edit3 size={13} /> Continue Editing
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={viewOnGuestPage}
                    style={{
                      ...buttonBase(),
                      minHeight: 36,
                      border: "none",
                      background: "transparent",
                      color: C.gold,
                      fontSize: 11,
                      fontWeight: 650,
                      justifyContent: "center",
                    }}
                  >
                    <Eye size={13} /> View Guest Page
                  </button>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  );
}

function compareRooms(sortBy) {
  return (a, b) => {
    if (sortBy === "name") return String(a.display_name || a.name).localeCompare(String(b.display_name || b.name));
    if (sortBy === "newest") return new Date(b.created_at || b.updated_at || 0) - new Date(a.created_at || a.updated_at || 0);
    if (sortBy === "oldest") return new Date(a.created_at || a.updated_at || 0) - new Date(b.created_at || b.updated_at || 0);
    if (sortBy === "status") return Number(b.is_active) - Number(a.is_active) || String(a.name).localeCompare(String(b.name));
    if (sortBy === "parent_first") return Number(Boolean(a.parent_id)) - Number(Boolean(b.parent_id)) || Number(a.display_order || 0) - Number(b.display_order || 0);
    return Number(a.display_order || 0) - Number(b.display_order || 0) || String(a.name).localeCompare(String(b.name));
  };
}

function formSectionStyle() {
  return {
    display: "grid",
    gap: 11,
    padding: 14,
    borderRadius: 13,
    background: C.soft,
    border: `1px solid ${C.divider}`,
  };
}

function sectionTitleStyle() {
  return {
    color: C.gold,
    fontSize: 9,
    fontWeight: 760,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
  };
}
