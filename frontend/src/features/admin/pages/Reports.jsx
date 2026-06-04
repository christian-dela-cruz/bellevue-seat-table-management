import { useEffect, useMemo, useState } from "react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
import Sidebar from "../../../components/layout/Sidebar";
import { authAPI } from "../../../services/authAPI";
import { reportAPI } from "../../../services/reportAPI";
import { venueAPI } from "../../../services/venueAPI";
import { fetchReservations } from "../../../utils/api";
import { Building2, Download, Layers, Printer, Utensils, Search, Activity, ChevronDown, CalendarDays, TrendingUp, Users, CheckCircle, Clock, AlertCircle, List, LayoutGrid } from "lucide-react";
import { ADMIN_OUTLET_GROUPS, buildOutletGroupsFromVenues, buildOutletRowsFromVenues, canAccessOutlet, canonicalOutletName, buildDynamicOutletTree, resolveOutletChildren } from "../../../constants/outletCatalog";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const C = {
  page: "#F7F4EE",
  surface: "#FFFFFF",
  soft: "#FAF8F4",
  border: "rgba(0,0,0,0.08)",
  divider: "rgba(0,0,0,0.05)",
  gold: "#8C6B2A",
  goldFaint: "rgba(140,107,42,0.08)",
  green: "#2E7A5A",
  greenFaint: "rgba(46,122,90,0.08)",
  red: "#A03838",
  redFaint: "rgba(160,56,56,0.08)",
  blue: "#3B6FA8",
  blueFaint: "rgba(59,111,168,0.08)",
  slate: "#5E6470",
  slateFaint: "rgba(94,100,112,0.08)",
  text: "#18140E",
  muted: "#7A7060",
  faint: "rgba(24,20,14,0.42)",
};

const F = {
  body: "'Inter','Helvetica Neue',Arial,sans-serif",
  label: "'Inter','Helvetica Neue',Arial,sans-serif",
};

function monthStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function readableDate(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function monthName(month, format = "long") {
  const date = new Date(2026, Number(month || 1) - 1, 1);
  return date.toLocaleDateString("en-US", { month: format });
}

function monthLabel(month, year) {
  return `${monthName(month)} ${year}`;
}

function monthOptions() {
  return Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: monthName(index + 1),
  }));
}

function readableDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function toneColor(tone = "gold") {
  return {
    gold: [C.gold, C.goldFaint],
    green: [C.green, C.greenFaint],
    red: [C.red, C.redFaint],
    blue: [C.blue, C.blueFaint],
    slate: [C.slate, C.slateFaint],
  }[tone] || [C.gold, C.goldFaint];
}

function getPresetDates(presetName) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);

  switch (presetName) {
    case "today":
      return { start: todayStr, end: todayStr };
    case "yesterday": {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return { start: d.toISOString().slice(0, 10), end: d.toISOString().slice(0, 10) };
    }
    case "this_week": {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      const monday = new Date(d.setDate(diff));
      return { start: monday.toISOString().slice(0, 10), end: todayStr };
    }
    case "last_7": {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      return { start: d.toISOString().slice(0, 10), end: todayStr };
    }
    case "this_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      return { start, end: todayStr };
    }
    case "last_30": {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      return { start: d.toISOString().slice(0, 10), end: todayStr };
    }
    case "ytd": {
      return { start: `${now.getFullYear()}-01-01`, end: todayStr };
    }
    default:
      return null;
  }
}

function DonutChart({ counts, total }) {
  const getStatusTone = (status) => {
    const s = String(status || "pending").toLowerCase();
    if (s.includes("reserved") || s.includes("approved") || s.includes("success")) return [C.green, C.greenFaint];
    if (s.includes("pending")) return [C.gold, C.goldFaint];
    if (s.includes("declined") || s.includes("rejected") || s.includes("red")) return [C.red, C.redFaint];
    return [C.slate, C.slateFaint];
  };

  const items = [
    ["Reserved", counts.reserved || 0, C.green],
    ["Pending", counts.pending || 0, C.gold],
    ["Declined", counts.declined || 0, C.red],
    ["Cancelled", counts.cancelled || 0, C.slate],
  ].filter((item) => item[1] > 0);

  let offset = 25;
  const circumference = 100;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "130px minmax(0,1fr)", gap: 16, alignItems: "center", padding: 16 }}>
      <svg viewBox="0 0 42 42" style={{ width: 130, height: 130, transform: "rotate(-90deg)" }}>
        <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="rgba(0,0,0,0.06)" strokeWidth="5" />
        {items.map(([label, value, color]) => {
          const dash = total > 0 ? (value / total) * circumference : 0;
          const segment = <circle key={label} cx="21" cy="21" r="15.915" fill="transparent" stroke={color} strokeWidth="5" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={offset} />;
          offset -= dash;
          return segment;
        })}
        <text x="21" y="22" textAnchor="middle" fontSize="7" fontWeight="700" fill={C.text} transform="rotate(90 21 21)">{total}</text>
      </svg>
      <div style={{ display: "grid", gap: 9 }}>
        {["reserved", "pending", "declined", "cancelled"].map((key) => {
          const [color, bg] = getStatusTone(key);
          const value = counts[key === "declined" ? "declined" : key] || 0;
          const pct = total ? Math.round((value / total) * 100) : 0;
          return (
            <div key={key} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", fontSize: 12, color: C.muted }}>
              <span style={{ display: "flex", alignItems: "center", gap: 8, textTransform: "capitalize" }}><i style={{ width: 8, height: 8, borderRadius: 999, background: color, boxShadow: `0 0 0 4px ${bg}` }} />{key}</span>
              <strong style={{ color: C.text }}>{value} ({pct}%)</strong>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, subtitle, right, children }) {
  return (
    <section style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold }}>{title}</div>
          {subtitle && <div style={{ marginTop: 4, fontSize: 12.5, color: C.muted }}>{subtitle}</div>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function MetricCard({ label, value, detail, tone = "gold" }) {
  const [color, bg] = toneColor(tone);

  return (
    <ReportCard style={{ padding: "16px 17px", minWidth: 0 }}>
      <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint, marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ color, background: bg, borderRadius: 8, padding: "5px 10px", minWidth: 48, textAlign: "center", fontSize: 22, fontWeight: 650, lineHeight: 1 }}>{value}</span>
        {detail && <span style={{ color: C.muted, fontSize: 12 }}>{detail}</span>}
      </div>
    </ReportCard>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ border: `1px solid ${C.divider}`, borderRadius: 8, padding: "8px 9px", background: C.soft, minWidth: 0 }}>
      <div style={{ fontSize: 9.5, color: C.faint, textTransform: "uppercase", letterSpacing: "0.10em", fontWeight: 700, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 650, color: C.text }}>{value}</div>
    </div>
  );
}

function ProgressRow({ label, value, total, tone = "gold" }) {
  const [color] = toneColor(tone);
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div style={{ display: "grid", gap: 4 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 11.5, color: C.muted }}>
        <span>{label}</span>
        <span>{value} <span style={{ color: C.faint, fontSize: 10.5 }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 4, borderRadius: 999, background: "rgba(0,0,0,0.04)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color, borderRadius: 999 }} />
      </div>
    </div>
  );
}

function StatusPill({ value }) {
  const status = String(value || "-");
  const tone = {
    reserved: [C.green, C.greenFaint],
    approved: [C.green, C.greenFaint],
    pending: [C.gold, C.goldFaint],
    rejected: [C.red, C.redFaint],
    cancelled: [C.slate, C.slateFaint],
  }[status.toLowerCase()] || [C.slate, C.slateFaint];

  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "3px 8px", background: tone[1], color: tone[0], fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
      {status}
    </span>
  );
}

function actionLabel(value) {
  return String(value || "-").replace(/_/g, " ");
}

function getPerformedBy(row) {
  if (row.actor_name) {
    return row.actor_role ? `${row.actor_name} (${row.actor_role})` : row.actor_name;
  }
  if (row.action === "cancelled_by_guest") {
    return "Guest";
  }
  return "System";
}

function outletGroup(outlet) {
  const wing = String(outlet?.wing || "").toLowerCase();
  const type = String(outlet?.type || "").toLowerCase();
  const name = String(outlet?.name || "").toLowerCase();

  if (wing.includes("dining") || type.includes("dining") || type.includes("restaurant") || name.includes("restaurant")) {
    return "dining";
  }

  return "rooms";
}

function compareValues(a, b, key) {
  const av = a?.[key];
  const bv = b?.[key];
  const an = Number(av);
  const bn = Number(bv);

  if (!Number.isNaN(an) && !Number.isNaN(bn)) return an - bn;
  return String(av ?? "").localeCompare(String(bv ?? ""), undefined, { numeric: true, sensitivity: "base" });
}

function sortRows(rows, sort) {
  if (!sort?.key) return rows;
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => compareValues(a, b, sort.key) * direction);
}

function mergeConfiguredReportRows(reportRows = [], venues = []) {
  const byName = new Map();

  reportRows.forEach((row) => {
    const name = canonicalOutletName(row?.name);
    if (!name) return;
    byName.set(name, { ...row, name });
  });

  buildOutletRowsFromVenues(venues).forEach((venue) => {
    const name = canonicalOutletName(venue.name);
    if (byName.has(name)) {
      const existing = byName.get(name);
      byName.set(name, {
        ...existing,
        wing: existing.wing || venue.wing,
        type: existing.type || venue.type,
      });
      return;
    }

    byName.set(name, {
      ...venue,
      total_reservations: 0,
      reservations: 0,
      guests: 0,
      reserved: 0,
      pending: 0,
      rejected: 0,
      cancelled: 0,
      acceptance_rate: 0,
      dine_in: 0,
      promotion_mentions: 0,
      configured: true,
    });
  });

  return Array.from(byName.values());
}

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename, rows, delimiter = ",") {
  const csv = rows.map((row) => row.map(csvCell).join(delimiter)).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function ActionButton({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 38,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        background: C.surface,
        color: C.gold,
        padding: "0 11px",
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontFamily: F.label,
        fontSize: 10,
        fontWeight: 750,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        cursor: "pointer",
      }}
    >
      <Icon size={14} />
      {label}
    </button>
  );
}

const SORT_OPTIONS = {
  outlets: [
    { value: "total_reservations:desc", label: "Reservations: high to low" },
    { value: "total_reservations:asc", label: "Reservations: low to high" },
    { value: "guests:desc", label: "Guests: high to low" },
    { value: "acceptance_rate:desc", label: "Acceptance rate: high to low" },
    { value: "name:asc", label: "Name: A to Z" },
  ],
  rooms: [
    { value: "reservations:desc", label: "Reservations: high to low" },
    { value: "guests:desc", label: "Guests: high to low" },
    { value: "latest_event_date:desc", label: "Latest event first" },
    { value: "room:asc", label: "Room: A to Z" },
  ],
  audit: [
    { value: "created_at:desc", label: "Newest first" },
    { value: "created_at:asc", label: "Oldest first" },
    { value: "action:asc", label: "Action: A to Z" },
    { value: "to_status:asc", label: "Status: A to Z" },
  ],
};

function sortValue(sort) {
  return `${sort?.key || ""}:${sort?.direction || "desc"}`;
}

function sortFromValue(value) {
  const [key, direction = "desc"] = value.split(":");
  return { key, direction };
}

function SortButton({ label, active, direction, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${active ? "rgba(140,107,42,0.28)" : C.border}`,
        background: active ? C.goldFaint : C.surface,
        color: active ? C.gold : C.muted,
        borderRadius: 999,
        padding: "7px 10px",
        fontFamily: F.label,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}{active ? ` ${direction === "asc" ? "↑" : "↓"}` : ""}
    </button>
  );
}

function SortSelect({ label = "Sort", value, options, onChange }) {
  return (
    <FilterField label={label}>
      <select value={sortValue(value)} onChange={(event) => onChange(sortFromValue(event.target.value))} style={{ ...filterStyle(), minWidth: 210 }}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>{option.label}</option>
        ))}
      </select>
    </FilterField>
  );
}

function FilterChip({ icon: Icon, label, count, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: `1px solid ${active ? "rgba(140,107,42,0.30)" : C.border}`,
        background: active ? C.goldFaint : C.surface,
        color: active ? C.gold : C.muted,
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        alignItems: "center",
        gap: 9,
        cursor: "pointer",
        minWidth: 0,
      }}
    >
      <Icon size={15} />
      <span style={{ fontSize: 12, fontWeight: 650, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ marginLeft: "auto", borderRadius: 999, background: active ? C.surface : C.soft, color: active ? C.gold : C.faint, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>{count}</span>
    </button>
  );
}

function ReportCard({ children, style }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 1px 5px rgba(24,20,14,0.025)", ...style }}>
      {children}
    </div>
  );
}

function SummaryPanel({ title, children }) {
  return (
    <ReportCard style={{ padding: 16, minWidth: 0 }}>
      <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold, marginBottom: 14 }}>{title}</div>
      {children}
    </ReportCard>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const visiblePayload = Array.from(
    payload.reduce((items, item) => {
      const key = item.dataKey || item.name;
      const existing = items.get(key);
      if (!existing || String(existing.name || existing.dataKey) === String(existing.dataKey)) {
        items.set(key, item);
      }
      return items;
    }, new Map()).values()
  );

  return (
    <div style={{ background: C.surface, border: "1px solid rgba(140,107,42,0.18)", borderRadius: 10, boxShadow: "0 2px 8px rgba(24,20,14,0.045)", padding: "10px 11px", minWidth: 160 }}>
      <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: C.gold, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {visiblePayload.map((item) => (
          <div key={item.dataKey} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, fontSize: 12, color: C.muted }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: item.color }} />
              {item.name}
            </span>
            <strong style={{ color: C.text, fontWeight: 700 }}>{item.value || 0}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function OutletCard({ outlet, onSelect }) {
  const total = outlet.total_reservations || 0;

  return (
    <div
      onClick={onSelect}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 16,
        display: "grid",
        gap: 12,
        minWidth: 0,
        overflow: "hidden",
        cursor: "pointer",
        transition: "transform 0.16s ease, border-color 0.16s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(140,107,42,0.30)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.transform = "none";
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <div title={outlet.name} style={{ fontSize: 15, fontWeight: 650, color: C.text, marginBottom: 4, lineHeight: 1.25, overflowWrap: "anywhere" }}>{outlet.name}</div>
          <div style={{ fontSize: 11.5, color: C.muted }}>{outlet.wing || "No wing"} - {outlet.type || "outlet"}</div>
        </div>
        <span style={{ padding: "4px 8px", borderRadius: 999, background: C.goldFaint, color: C.gold, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{outlet.acceptance_rate}% approved</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(82px,1fr))", gap: 8 }}>
        <MiniStat label="Total" value={total} />
        <MiniStat label="Guests" value={outlet.guests || 0} />
        <MiniStat label="Dine-In" value={outlet.dine_in || 0} />
        <MiniStat label="Promo" value={outlet.promotion_mentions || 0} />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <ProgressRow label="Reserved" value={outlet.reserved || 0} total={total} tone="green" />
        <ProgressRow label="Pending" value={outlet.pending || 0} total={total} tone="gold" />
        <ProgressRow label="Rejected" value={outlet.rejected || 0} total={total} tone="red" />
      </div>
    </div>
  );
}

function RoomGridCard({ room, onSelect }) {
  const total = room.reservations || 0;
  const acceptanceRate = total > 0 ? Math.round(((room.reserved || 0) / total) * 100) : 0;

  return (
    <div
      onClick={onSelect}
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 10,
        padding: 16,
        display: "grid",
        gap: 12,
        minWidth: 0,
        overflow: "hidden",
        cursor: "pointer",
        transition: "transform 0.16s ease, border-color 0.16s ease",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "rgba(140,107,42,0.30)";
        e.currentTarget.style.transform = "translateY(-1px)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = C.border;
        e.currentTarget.style.transform = "none";
      }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 12, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          <div title={room.room} style={{ fontSize: 14, fontWeight: 650, color: C.text, marginBottom: 4, lineHeight: 1.25, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{room.room}</div>
          <div style={{ fontSize: 11, color: C.muted }}>Latest Event: {room.latest_event_date || "-"}</div>
        </div>
        <span style={{ padding: "3px 7px", borderRadius: 999, background: C.goldFaint, color: C.gold, fontSize: 9.5, fontWeight: 700, whiteSpace: "nowrap" }}>{acceptanceRate}% approved</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6 }}>
        <MiniStat label="Reservations" value={total} />
        <MiniStat label="Guests" value={room.guests || 0} />
        <MiniStat label="Dine-In" value={room.dine_in || 0} />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <ProgressRow label="Reserved" value={room.reserved || 0} total={total} tone="green" />
        <ProgressRow label="Pending" value={room.pending || 0} total={total} tone="gold" />
        <ProgressRow label="Rejected" value={room.rejected || 0} total={total} tone="red" />
      </div>
    </div>
  );
}

function TransactionMonitor({ transactionReport, isGlobal, sort, onSort }) {
  const summary = transactionReport.summary || {};
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const rows = sortRows(transactionReport.data || [], sort);
  const totalPages = Math.max(1, Math.ceil(rows.length / rowsPerPage));
  const visibleRows = rows.slice((page - 1) * rowsPerPage, page * rowsPerPage);

  useEffect(() => {
    setPage(1);
  }, [rowsPerPage, sort?.key, sort?.direction, transactionReport.data]);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  return (
    <SummaryPanel title="Transaction Monitor">
      <div style={{ display: "grid", gap: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div style={{ fontSize: 12.5, color: C.muted }}>
            {isGlobal ? "Read-only view across all outlets." : "Read-only view limited to assigned outlets."}
          </div>
          <span style={{ padding: "5px 9px", borderRadius: 999, background: isGlobal ? C.blueFaint : C.goldFaint, color: isGlobal ? C.blue : C.gold, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.10em" }}>
            {isGlobal ? "Global View" : "Scoped View"}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
          <MiniStat label="Transactions" value={summary.transactions || 0} />
          <MiniStat label="Approvals" value={summary.approvals || 0} />
          <MiniStat label="Rejections" value={summary.rejections || 0} />
          <MiniStat label="Reverts" value={summary.reverts || 0} />
        </div>

        <div style={{ border: `1px solid ${C.divider}`, borderRadius: 12, overflow: "hidden", background: C.surface }}>
          <div style={{ padding: "12px 14px", background: C.soft, borderBottom: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>Audit Records</div>
              <div style={{ marginTop: 3, fontSize: 11.5, color: C.muted }}>{rows.length} transaction{rows.length === 1 ? "" : "s"} found for the selected range.</div>
            </div>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
              <FilterField label="Rows">
                <select value={rowsPerPage} onChange={(event) => setRowsPerPage(Number(event.target.value))} style={{ ...filterStyle(), minWidth: 118 }}>
                  {[10, 25, 50, 100].map((value) => <option key={value} value={value}>{value} entries</option>)}
                </select>
              </FilterField>
              <SortSelect value={sort} options={SORT_OPTIONS.audit} onChange={onSort} />
            </div>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
              <thead>
                <tr style={{ background: C.soft, color: C.faint, textTransform: "uppercase", letterSpacing: "0.10em", fontSize: 10 }}>
                  {["Time", "Reference", "Guest", "Outlet / Room", "Change", "Action", "Performed By", "Notes"].map((header) => (
                    <th key={header} style={tableHeadStyle()}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: "16px 12px", color: C.muted }}>No transactions found for this date range.</td>
                  </tr>
                ) : visibleRows.map((row) => {
                  const reservation = row.reservation || {};
                  const venue = row.venue || {};
                  return (
                    <tr key={row.id} className="reports-table-row">
                      <td style={cellStyle()}>{readableDateTime(row.created_at)}</td>
                      <td style={cellStyle(true)}>{reservation.reference_code || "-"}</td>
                      <td style={cellStyle()}>{reservation.name || "-"}</td>
                      <td style={cellStyle()}>{venue.name || reservation.room || "-"}</td>
                      <td style={cellStyle()}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                          {row.from_status && row.to_status && row.from_status !== row.to_status ? (
                            <>
                              <StatusPill value={row.from_status} />
                              <span style={{ color: C.faint }}>to</span>
                              <StatusPill value={row.to_status} />
                            </>
                          ) : (
                            <>
                              <StatusPill value={row.to_status || row.from_status || reservation.status} />
                              <span style={{ color: C.faint }}>current</span>
                            </>
                          )}
                        </div>
                      </td>
                      <td style={cellStyle()}>{actionLabel(row.action)}</td>
                      <td style={cellStyle()}>{getPerformedBy(row)}</td>
                      <td style={{ ...cellStyle(), whiteSpace: "normal", minWidth: 220 }}>{row.notes || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div style={{ padding: "11px 14px", borderTop: `1px solid ${C.divider}`, background: C.soft, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", color: C.muted, fontSize: 12 }}>
            <span>
              Showing {rows.length === 0 ? 0 : (page - 1) * rowsPerPage + 1}-{Math.min(page * rowsPerPage, rows.length)} of {rows.length}
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                style={{ ...pagerButtonStyle(), opacity: page === 1 ? 0.45 : 1, cursor: page === 1 ? "not-allowed" : "pointer" }}
              >
                Previous
              </button>
              <span style={{ color: C.muted }}>Page {page} of {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page === totalPages}
                style={{ ...pagerButtonStyle(), opacity: page === totalPages ? 0.45 : 1, cursor: page === totalPages ? "not-allowed" : "pointer" }}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </SummaryPanel>
  );
}

function MonthlyLineChart({
  months,
  description = "Reservation volume by month, with promotion mentions shown as a comparison line.",
  xAxisKey = "label",
}) {
  const data = (months || []).map((row) => ({
    ...row,
    label: row.label || row.month || row.date_range || row.date,
    reservations: Number(row.reservations || 0),
    promotion_mentions: Number(row.promotion_mentions || 0),
  }));
  const labelInterval = data.length > 16 ? Math.ceil(data.length / 8) - 1 : 0;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: C.muted }}>{description}</div>
      </div>

      <div style={{ width: "100%", minHeight: 320, borderRadius: 14, background: "linear-gradient(135deg,#FFFFFF 0%,#FAF8F4 58%,#F1ECE1 100%)", border: `1px solid ${C.divider}`, padding: "16px 12px 8px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.72)" }}>
        <ResponsiveContainer width="100%" height={290}>
          <ComposedChart data={data} margin={{ top: 12, right: 28, bottom: 8, left: -8 }}>
            <defs>
              <linearGradient id="reportsReservationFill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={C.blue} stopOpacity="0.22" />
                <stop offset="52%" stopColor={C.blue} stopOpacity="0.08" />
                <stop offset="100%" stopColor={C.blue} stopOpacity="0.01" />
              </linearGradient>
              <filter id="reportsLineShadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#3B6FA8" floodOpacity="0.16" />
              </filter>
            </defs>
            <CartesianGrid stroke="rgba(24,20,14,0.07)" vertical={false} />
            <XAxis
              dataKey={xAxisKey}
              interval={labelInterval}
              tick={{ fill: C.muted, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              minTickGap={10}
              padding={{ left: 12, right: 16 }}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: C.faint, fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={34}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(140,107,42,0.22)", strokeDasharray: "4 4" }} wrapperStyle={{ outline: "none" }} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="plainline"
              wrapperStyle={{ fontSize: 11, color: C.muted, paddingBottom: 12 }}
              payload={[
                { value: "Reservation activity", type: "plainline", color: C.blue },
                { value: "Promotion mentions", type: "plainline", color: C.gold },
              ]}
            />
            <Area
              type="monotone"
              dataKey="reservations"
              legendType="none"
              fill="url(#reportsReservationFill)"
              stroke="none"
              dot={false}
              activeDot={false}
              connectNulls
              isAnimationActive
              animationDuration={760}
            />
            <Line
              type="monotone"
              dataKey="reservations"
              name="Reservations"
              stroke={C.blue}
              strokeWidth={3.35}
              dot={false}
              activeDot={{ r: 5.5, strokeWidth: 3, stroke: C.surface, fill: C.blue }}
              connectNulls
              isAnimationActive
              animationDuration={720}
              filter="url(#reportsLineShadow)"
            />
            <Line
              type="monotone"
              dataKey="promotion_mentions"
              name="Promotion mentions"
              stroke={C.gold}
              strokeWidth={2.45}
              strokeDasharray="6 6"
              dot={false}
              activeDot={{ r: 5, strokeWidth: 3, stroke: C.surface, fill: C.gold }}
              connectNulls
              isAnimationActive
              animationDuration={760}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function MonthlyReports({ monthlyReport, granularity = "daily", monthLabelText }) {
  const selectedMonth = monthlyReport.selected_month || {};
  const outlets = selectedMonth.outlets || [];
  const summary = selectedMonth.summary || {};
  const activityRows = granularity === "weekly" ? (selectedMonth.weeks || []) : (selectedMonth.days || []);
  const chartDescription = granularity === "weekly"
    ? `Weekly reservation density for ${monthLabelText}, useful for management review and staffing rhythm.`
    : `Daily reservation activity for ${monthLabelText}, showing spikes, quiet dates, and promotion mentions.`;
  const reservations = summary.reservations || 0;
  const reserved = summary.reserved || summary.approved || 0;
  const approvalRate = reservations ? Math.round((reserved / reservations) * 100) : 0;
  const peakPeriod = granularity === "weekly"
    ? (summary.peak_week || activityRows.reduce((best, row) => ((row.reservations || 0) > (best.reservations || 0) ? row : best), {}).label || "-")
    : (summary.peak_day || activityRows.reduce((best, row) => ((row.reservations || 0) > (best.reservations || 0) ? row : best), {}).label || "-");
  const promoPeriod = activityRows.reduce((best, row) => ((row.promotion_mentions || 0) > (best.promotion_mentions || 0) ? row : best), {}).label || "-";
  const activeDays = summary.active_days || (selectedMonth.days || []).filter((day) => (day.reservations || 0) > 0).length;
  const topOutlet = outlets[0];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        <MetricCard label="Month Total" value={reservations} detail={`${activeDays} active day${activeDays === 1 ? "" : "s"}`} tone="blue" />
        <MetricCard label="Approval Rate" value={`${approvalRate}%`} detail={`${reserved} approved`} tone="green" />
        <MetricCard label={granularity === "weekly" ? "Peak Week" : "Peak Date"} value={peakPeriod} tone="gold" />
        <MetricCard label="Promotions" value={summary.promotion_mentions || 0} detail="mentions" tone="slate" />
      </div>

      <div className="reports-grid" style={{ display: "grid", gridTemplateColumns: "minmax(320px,1.2fr) minmax(280px,0.8fr)", gap: 14 }}>
        <SummaryPanel title={`Reservation Activity - ${monthLabelText}`}>
          <div style={{ display: "grid", gap: 12 }}>
            <MonthlyLineChart
              months={activityRows}
              description={chartDescription}
              xAxisKey="label"
            />
          </div>
        </SummaryPanel>

        <SummaryPanel title="Operational Highlights">
          <div style={{ display: "grid", gap: 12 }}>
            <InsightRow label={granularity === "weekly" ? "Busiest week" : "Busiest date"} value={peakPeriod} detail={`Highest reservation volume in ${monthLabelText}.`} tone="gold" />
            <InsightRow label="Top outlet" value={topOutlet?.outlet || "-"} detail={topOutlet ? `${topOutlet.reservations || 0} reservations recorded this month.` : "No outlet activity yet."} tone="blue" />
            <InsightRow label="Promotion activity" value={promoPeriod} detail={`${summary.promotion_mentions || 0} total promotion mentions.`} tone="slate" />
            <InsightRow label="Reservation health" value={`${approvalRate}% approved`} detail="Quick read for month-level operational review." tone="green" />
          </div>
        </SummaryPanel>
      </div>

      <div className="reports-grid" style={{ display: "grid", gridTemplateColumns: "minmax(280px,0.85fr) minmax(320px,1.15fr)", gap: 14 }}>
        <SummaryPanel title="Status Distribution">
          <div style={{ display: "grid", gap: 11 }}>
            <ProgressRow label="Reserved" value={summary.reserved || 0} total={reservations} tone="green" />
            <ProgressRow label="Pending" value={summary.pending || 0} total={reservations} tone="gold" />
            <ProgressRow label="Rejected" value={summary.rejected || 0} total={reservations} tone="red" />
            <ProgressRow label="Cancelled" value={summary.cancelled || 0} total={reservations} tone="slate" />
          </div>
        </SummaryPanel>

        <TableCard
          title="Top Outlets This Month"
          headers={["Outlet", "Reservations"]}
          rows={outlets.slice(0, 6)}
          renderRow={(outlet) => (
            <tr key={outlet.outlet}>
              <td style={cellStyle(true)}>{outlet.outlet}</td>
              <td style={cellStyle()}>{outlet.reservations}</td>
            </tr>
          )}
        />
      </div>
    </div>
  );
}

function YearlyReports({ monthlyReport, transactionSummary }) {
  const months = monthlyReport.months || [];
  const outlets = monthlyReport.outlets || [];
  const summary = monthlyReport.summary || {};
  const reservations = summary.reservations || 0;
  const reserved = summary.reserved || summary.approved || 0;
  const approvalRate = reservations ? Math.round((reserved / reservations) * 100) : 0;
  const peakMonth = summary.peak_month || months.reduce((best, month) => ((month.reservations || 0) > (best.reservations || 0) ? month : best), {}).label || "-";
  const topOutlet = outlets[0];
  const activeMonths = months.filter((month) => (month.reservations || 0) > 0).length;
  const quarters = [
    ["Q1", months.slice(0, 3)],
    ["Q2", months.slice(3, 6)],
    ["Q3", months.slice(6, 9)],
    ["Q4", months.slice(9, 12)],
  ].map(([label, rows]) => ({
    label,
    reservations: rows.reduce((sum, month) => sum + Number(month.reservations || 0), 0),
    promotions: rows.reduce((sum, month) => sum + Number(month.promotion_mentions || 0), 0),
  }));

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        <MetricCard label="Year Total" value={reservations} detail={`${activeMonths} active months`} tone="blue" />
        <MetricCard label="Approval Rate" value={`${approvalRate}%`} detail={`${reserved} approved`} tone="green" />
        <MetricCard label="Peak Month" value={peakMonth} tone="gold" />
        <MetricCard label="Transactions" value={transactionSummary.transactions || 0} detail="audit records" tone="slate" />
      </div>

      <div className="reports-grid" style={{ display: "grid", gridTemplateColumns: "minmax(320px,1.15fr) minmax(280px,0.85fr)", gap: 14 }}>
        <SummaryPanel title={`Annual Activity ${monthlyReport.year || ""}`}>
          <div style={{ display: "grid", gap: 12 }}>
            <MonthlyLineChart
              months={months}
              description="Annual reservation seasonality by month, with promotion mentions shown as a comparison line."
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
              {quarters.map((quarter) => (
                <div key={quarter.label} style={{ border: `1px solid ${C.divider}`, borderRadius: 9, background: C.soft, padding: 10 }}>
                  <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold }}>{quarter.label}</div>
                  <div style={{ marginTop: 8, fontSize: 20, fontWeight: 650, color: C.text }}>{quarter.reservations}</div>
                  <div style={{ marginTop: 2, fontSize: 11.5, color: C.muted }}>{quarter.promotions} promo mention{quarter.promotions === 1 ? "" : "s"}</div>
                </div>
              ))}
            </div>
          </div>
        </SummaryPanel>

        <SummaryPanel title="Management Highlights">
          <div style={{ display: "grid", gap: 12 }}>
            <InsightRow label="Busiest month" value={peakMonth} detail="Highest reservation volume in the selected year." tone="gold" />
            <InsightRow label="Top outlet" value={topOutlet?.outlet || "-"} detail={topOutlet ? `${topOutlet.reservations || 0} reservations recorded.` : "No outlet activity yet."} tone="blue" />
            <InsightRow label="Reservation health" value={`${approvalRate}% approved`} detail="Useful for management-level performance review." tone="green" />
            <InsightRow label="Promotion activity" value={summary.promotion_mentions || 0} detail="Total promotion mentions across the year." tone="slate" />
          </div>
        </SummaryPanel>
      </div>

      <TableCard
        title="Yearly Outlet Ranking"
        headers={["Outlet", "Reservations"]}
        rows={outlets.slice(0, 10)}
        renderRow={(outlet) => (
          <tr key={outlet.outlet}>
            <td style={cellStyle(true)}>{outlet.outlet}</td>
            <td style={cellStyle()}>{outlet.reservations}</td>
          </tr>
        )}
      />
    </div>
  );
}

function InsightRow({ label, value, detail, tone = "gold" }) {
  const [color, bg] = toneColor(tone);

  return (
    <div style={{ border: `1px solid ${C.divider}`, borderRadius: 10, padding: 12, background: C.soft, display: "grid", gap: 5 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.faint }}>{label}</span>
        <span style={{ width: 9, height: 9, borderRadius: 999, background: color, boxShadow: `0 0 0 4px ${bg}` }} />
      </div>
      <div style={{ color: C.text, fontSize: 15, fontWeight: 650, overflowWrap: "anywhere" }}>{value}</div>
      <div style={{ color: C.muted, fontSize: 12, lineHeight: 1.45 }}>{detail}</div>
    </div>
  );
}

function TableCard({ title, headers, rows, renderRow, actions, footer }) {
  return (
    <ReportCard style={{ overflow: "hidden", minWidth: 0 }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.divider}`, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>{title}</div>
        {actions}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr style={{ background: C.soft, color: C.faint, textTransform: "uppercase", letterSpacing: "0.10em", fontSize: 10 }}>
              {headers.map((header) => <th key={header} style={tableHeadStyle()}>{header}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={headers.length} style={{ padding: "16px 12px", color: C.muted }}>No records found.</td></tr>
            ) : rows.map(renderRow)}
          </tbody>
        </table>
      </div>
      {footer}
    </ReportCard>
  );
}

function ReportTabs({ groups, activeTab, onChange }) {
  return (
    <div className="reports-nav-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 10 }}>
      {groups.map((group) => (
        <div key={group.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 10, display: "grid", gap: 9, minWidth: 0 }}>
          <div style={{ display: "grid", gap: 3 }}>
            <div style={{ fontFamily: F.label, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>{group.label}</div>
            <div style={{ fontSize: 11.5, color: C.muted, lineHeight: 1.35 }}>{group.description}</div>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {group.tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onChange(tab.id)}
                  style={{
                    border: `1px solid ${active ? "rgba(140,107,42,0.30)" : C.divider}`,
                    borderRadius: 9,
                    background: active ? C.goldFaint : C.soft,
                    color: active ? C.gold : C.muted,
                    padding: "8px 10px",
                    fontFamily: F.label,
                    fontSize: 10.5,
                    fontWeight: active ? 800 : 650,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    cursor: "pointer",
                    transition: "background 0.16s ease, border-color 0.16s ease, color 0.16s ease, transform 0.16s ease",
                    boxShadow: active ? "0 1px 5px rgba(140,107,42,0.045)" : "none",
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(today());
  const [reportYear, setReportYear] = useState(today().slice(0, 4));
  const [reportMonth, setReportMonth] = useState(String(Number(today().slice(5, 7))));
  const [monthlyGranularity, setMonthlyGranularity] = useState("daily");
  const [selectedOutlet, setSelectedOutlet] = useState("ALL");
  const [selectedOutletGroup, setSelectedOutletGroup] = useState("all");
  const [outletSort, setOutletSort] = useState({ key: "total_reservations", direction: "desc" });
  const [roomSort, setRoomSort] = useState({ key: "reservations", direction: "desc" });
  const [auditSort, setAuditSort] = useState({ key: "created_at", direction: "desc" });
  const [outletSearchQuery, setOutletSearchQuery] = useState("");
  const [roomSearchQuery, setRoomSearchQuery] = useState("");
  const [datePreset, setDatePreset] = useState("this_month");
  const [roomViewMode, setRoomViewMode] = useState("list");
  const [outletViewMode, setOutletViewMode] = useState("grid");
  const [activeOutletDetails, setActiveOutletDetails] = useState(null);
  const [showPrintConfig, setShowPrintConfig] = useState(false);
  const [printReportType, setPrintReportType] = useState("general");
  const [printSections, setPrintSections] = useState({
    overview: true,
    mix: true,
    outlets: true,
    rooms: true,
    trends: true,
    audit: true,
  });
  const [printFontScale, setPrintFontScale] = useState("medium");
  const [printPageSize, setPrintPageSize] = useState("a4");
  const [printOrientation, setPrintOrientation] = useState("landscape");
  const [roomRowsPerPage, setRoomRowsPerPage] = useState(10);
  const [roomPage, setRoomPage] = useState(1);

  // CSV Configuration States (RPT-005)
  const [showCsvConfig, setShowCsvConfig] = useState(false);
  const [csvFilename, setCsvFilename] = useState("");
  const [csvExportType, setCsvExportType] = useState("unified"); // "unified" or "raw"
  const [csvDelimiter, setCsvDelimiter] = useState(",");
  const [csvIncludeHeaders, setCsvIncludeHeaders] = useState(true);
  const [csvSections, setCsvSections] = useState({
    summary: true,
    status: true,
    trends: true,
    outlets: true,
    rooms: true,
  });
  const [reservations, setReservations] = useState([]);

  const handlePrintReportTypeChange = (type) => {
    setPrintReportType(type);
    if (type === "general") {
      setPrintSections({
        overview: true,
        mix: true,
        outlets: true,
        rooms: true,
        trends: true,
        audit: true,
      });
    }
  };

  const handleSectionCheckboxChange = (section, checked) => {
    setPrintSections((prev) => {
      const next = { ...prev, [section]: checked };
      const allChecked = Object.values(next).every(Boolean);
      setPrintReportType(allChecked ? "general" : "custom");
      return next;
    });
  };

  const handleDatePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset === "custom") return;
    const dates = getPresetDates(preset);
    if (dates) {
      setStartDate(dates.start);
      setEndDate(dates.end);
    }
  };
  const [report, setReport] = useState({ summary: {}, data: [] });
  const [transactionReport, setTransactionReport] = useState({ summary: {}, data: [] });
  const [monthlyReport, setMonthlyReport] = useState({ summary: {}, months: [], outlets: [] });
  const [venueRows, setVenueRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canViewReports = authAPI.hasPermission("view_outlet_reports");
  const canViewTransactions = authAPI.hasPermission("view_transactions");
  const canViewGlobalReports = authAPI.hasPermission("view_global_reports");
  const currentUser = useMemo(() => authAPI.getCurrentUser(), []);
  const outletGroups = useMemo(() => {
    const dynamicGroups = buildOutletGroupsFromVenues(venueRows);
    return dynamicGroups.length ? dynamicGroups : ADMIN_OUTLET_GROUPS;
  }, [venueRows]);
  const reportOutletRows = useMemo(
    () => mergeConfiguredReportRows(report.data || [], venueRows),
    [report.data, venueRows]
  );

  const loadReport = async () => {
    if (!canViewReports) return;
    setLoading(true);
    setError("");

    try {
      const selectedYear = Number(reportYear) || Number(today().slice(0, 4));
      const selectedMonth = Number(reportMonth) || Number(today().slice(5, 7));
      const [outletData, transactionData, monthlyData, venuesData, reservationData] = await Promise.all([
        reportAPI.getOutletReports({ start_date: startDate, end_date: endDate }),
        canViewTransactions
          ? reportAPI.getTransactionReports({ start_date: startDate, end_date: endDate })
          : Promise.resolve(null),
        reportAPI.getMonthlyReports({ year: selectedYear, month: selectedMonth }),
        venueAPI.getAll({ include_archived: false, _t: Date.now() }).catch(() => []),
        fetchReservations(1, 9999).catch(() => []),
      ]);
      setReport(outletData);
      if (transactionData) setTransactionReport(transactionData);
      setMonthlyReport(monthlyData);
      setVenueRows(Array.isArray(venuesData) ? venuesData : []);
      setReservations(Array.isArray(reservationData?.data) ? reservationData.data : Array.isArray(reservationData) ? reservationData : []);
    } catch (err) {
      setError(err.message || "Failed to load outlet report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  useEffect(() => {
    setRoomPage(1);
  }, [roomRowsPerPage, roomSearchQuery, roomSort]);

  const filteredOutlets = useMemo(() => {
    const rows = reportOutletRows.filter((row) => canAccessOutlet(currentUser, row.name, outletGroups));
    const children = selectedOutlet !== "ALL" ? resolveOutletChildren(selectedOutlet, venueRows) : [];
    const childrenSet = new Set(children.map(canonicalOutletName));
    const outletFiltered = selectedOutlet === "ALL"
      ? rows
      : rows.filter((row) => {
        const canonicalRowName = canonicalOutletName(row.name);
        return canonicalRowName === selectedOutlet || childrenSet.has(canonicalRowName);
      });
    const groupFiltered = selectedOutletGroup === "all"
      ? outletFiltered
      : outletFiltered.filter((row) => outletGroup(row) === selectedOutletGroup);
    const searchFiltered = !outletSearchQuery.trim()
      ? groupFiltered
      : groupFiltered.filter((row) =>
        String(row.name).toLowerCase().includes(outletSearchQuery.toLowerCase()) ||
        String(row.wing || "").toLowerCase().includes(outletSearchQuery.toLowerCase()) ||
        String(row.type || "").toLowerCase().includes(outletSearchQuery.toLowerCase())
      );
    return sortRows(searchFiltered, outletSort);
  }, [currentUser, outletGroups, reportOutletRows, selectedOutlet, selectedOutletGroup, outletSort, outletSearchQuery]);

  const summary = report.summary || {};
  const category = report.category_breakdown || {};
  const statuses = report.status_breakdown || {};
  const reservedCount = (statuses.reserved || 0) + (statuses.approved || 0);
  const totalReservations = summary.reservations || 0;

  const isFiltered = selectedOutlet !== "ALL";

  const filteredSummary = useMemo(() => {
    if (!isFiltered) {
      return {
        reservations: summary.reservations || 0,
        guests: summary.guests || 0,
        reserved: reservedCount,
        pending: statuses.pending || 0,
        rejected: statuses.rejected || 0,
        cancelled: statuses.cancelled || 0,
      };
    }

    let reservations = 0;
    let guests = 0;
    let reserved = 0;
    let pending = 0;
    let rejected = 0;
    let cancelled = 0;

    filteredOutlets.forEach((out) => {
      reservations += Number(out.total_reservations || 0);
      guests += Number(out.guests || 0);
      reserved += Number(out.reserved || 0);
      pending += Number(out.pending || 0);
      rejected += Number(out.rejected || 0);
      cancelled += Number(out.cancelled || 0);
    });

    return {
      reservations,
      guests,
      reserved,
      pending,
      rejected,
      cancelled,
    };
  }, [isFiltered, summary, filteredOutlets, reservedCount, statuses]);

  const filteredCategory = useMemo(() => {
    if (!isFiltered) {
      return {
        dine_in: {
          reservations: category.dine_in?.reservations || 0,
          guests: category.dine_in?.guests || 0,
        },
        room_reservations: {
          reservations: category.room_reservations?.reservations || 0,
          guests: category.room_reservations?.guests || 0,
        },
        promotion_mentions: {
          reservations: category.promotion_mentions?.reservations || 0,
        },
      };
    }

    let dineInCount = 0;
    let dineInGuests = 0;
    let roomCount = 0;
    let roomGuests = 0;
    let promoCount = 0;

    filteredOutlets.forEach((out) => {
      const isDining = outletGroup(out) === "dining";
      dineInCount += Number(out.dine_in || 0);
      promoCount += Number(out.promotion_mentions || 0);
      if (isDining) {
        dineInGuests += Number(out.guests || 0);
        roomCount += Math.max(0, Number(out.total_reservations || 0) - Number(out.dine_in || 0));
      } else {
        roomCount += Number(out.total_reservations || 0);
        roomGuests += Number(out.guests || 0);
      }
    });

    return {
      dine_in: {
        reservations: dineInCount,
        guests: dineInGuests,
      },
      room_reservations: {
        reservations: roomCount,
        guests: roomGuests,
      },
      promotion_mentions: {
        reservations: promoCount,
      },
    };
  }, [isFiltered, category, filteredOutlets]);

  const roomDetails = useMemo(() => {
    const baseRooms = (report.room_details || []).filter((row) => canAccessOutlet(currentUser, row.room, outletGroups));
    const children = selectedOutlet !== "ALL" ? resolveOutletChildren(selectedOutlet, venueRows) : [];
    const childrenSet = new Set([selectedOutlet, ...children].map(canonicalOutletName));
    const outletFiltered = selectedOutlet === "ALL"
      ? baseRooms
      : baseRooms.filter((row) => childrenSet.has(canonicalOutletName(row.room)));
    const searchFiltered = !roomSearchQuery.trim()
      ? outletFiltered
      : outletFiltered.filter((row) =>
        String(row.room).toLowerCase().includes(roomSearchQuery.toLowerCase())
      );
    return sortRows(searchFiltered, roomSort);
  }, [currentUser, outletGroups, report.room_details, roomSort, roomSearchQuery, selectedOutlet, venueRows]);

  const totalRoomPages = Math.max(1, Math.ceil(roomDetails.length / roomRowsPerPage));
  const visibleRoomRows = useMemo(() => {
    return roomDetails.slice((roomPage - 1) * roomRowsPerPage, roomPage * roomRowsPerPage);
  }, [roomDetails, roomPage, roomRowsPerPage]);

  const outletTransactions = useMemo(() => {
    if (!activeOutletDetails || !transactionReport.data) return [];
    const canonicalSelected = canonicalOutletName(activeOutletDetails);
    return transactionReport.data.filter((row) => {
      const room = row.reservation?.room || row.venue?.name || "";
      return canonicalOutletName(room) === canonicalSelected;
    });
  }, [activeOutletDetails, transactionReport.data]);

  const outletChartData = useMemo(() => {
    if (!activeOutletDetails || !outletTransactions.length) return [];
    const countsByDate = {};
    outletTransactions.forEach((tx) => {
      const dateVal = tx.created_at ? tx.created_at.slice(0, 10) : null;
      if (!dateVal) return;
      if (!countsByDate[dateVal]) {
        countsByDate[dateVal] = { reservations: 0, approvals: 0, rejections: 0 };
      }
      countsByDate[dateVal].reservations += 1;
      if (tx.to_status === "reserved" || tx.to_status === "approved") {
        countsByDate[dateVal].approvals += 1;
      } else if (tx.to_status === "rejected") {
        countsByDate[dateVal].rejections += 1;
      }
    });

    return Object.keys(countsByDate)
      .sort()
      .map((date) => ({
        date,
        label: readableDate(date),
        reservations: countsByDate[date].reservations,
        approvals: countsByDate[date].approvals,
        rejections: countsByDate[date].rejections,
      }));
  }, [activeOutletDetails, outletTransactions]);

  const activeOutletRow = useMemo(() => {
    if (!activeOutletDetails) return null;
    return reportOutletRows.find((row) => canonicalOutletName(row.name) === canonicalOutletName(activeOutletDetails));
  }, [activeOutletDetails, reportOutletRows]);

  const printStyles = `
    @media print {
      /* Reset and base styles */
      html, body {
        background: #FFFFFF !important;
        color: #18140E !important;
        font-family: 'Inter', Arial, sans-serif !important;
        margin: 0 !important;
        padding: 0 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }

      .reports-main-container {
        background: transparent !important;
        min-height: auto !important;
      }
      
      /* Hide all screen interfaces */
      .print-exclude, aside, nav, header, button, .reports-filter-panel, .reports-nav-grid, main, .reports-section {
        display: none !important;
      }
      
      /* Show and format print container */
      .print-only {
        display: block !important;
        padding: 0 !important;
        background: #FFFFFF !important;
        font-size: ${printFontScale === "small" ? "9pt" :
      printFontScale === "large" ? "13pt" :
        "11pt"
    } !important;
      }

      /* Page layout settings */
      @page {
        size: ${printPageSize} ${printOrientation};
        margin: 1.5cm !important;
      }

      /* Clean luxury headings & tables for print */
      .print-header {
        border-bottom: 3px solid #8C6B2A !important;
        padding-bottom: 12px;
        margin-bottom: 24px;
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
      }

      .print-title {
        font-size: 20pt !important;
        font-weight: 700 !important;
        color: #18140E !important;
        text-transform: uppercase !important;
        letter-spacing: 0.06em !important;
      }

      .print-section {
        page-break-inside: avoid !important;
        margin-bottom: 38px !important;
      }

      .print-section-title {
        font-size: 11pt !important;
        font-weight: 800 !important;
        text-transform: uppercase !important;
        color: #8C6B2A !important;
        letter-spacing: 0.12em !important;
        margin-bottom: 12px;
        border-bottom: 1px solid rgba(0,0,0,0.08) !important;
        padding-bottom: 4px;
      }

      .print-table {
        width: 100% !important;
        border-collapse: collapse !important;
        margin-top: 12px;
        font-size: 8.5pt !important;
        line-height: 1.45 !important;
      }

      .print-table th {
        background: #FAF8F4 !important;
        color: #7A7060 !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        letter-spacing: 0.06em !important;
        font-size: 7.5pt !important;
        padding: 10px 8px !important;
        border-bottom: 2px solid #8C6B2A !important;
        text-align: left !important;
      }

      .print-table td {
        padding: 10px 8px !important;
        border-bottom: 1px solid rgba(0,0,0,0.06) !important;
        color: #4A505E !important;
        font-size: 8.5pt !important;
      }

      .print-table tr:last-child td {
        border-bottom: none !important;
      }

      .print-table td.strong {
        color: #18140E !important;
        font-weight: 700 !important;
        white-space: nowrap !important;
      }

      .print-grid {
        display: grid !important;
        grid-template-columns: repeat(4, 1fr) !important;
        gap: 16px !important;
        margin-bottom: 24px !important;
      }

      .print-card {
        background: #FAF8F4 !important;
        border: 1px solid rgba(140,107,42,0.12) !important;
        border-radius: 8px !important;
        padding: 14px 16px !important;
      }

      .print-card-label {
        font-size: 8pt !important;
        font-weight: 700 !important;
        text-transform: uppercase !important;
        color: #7A7060 !important;
        letter-spacing: 0.08em !important;
        margin-bottom: 6px;
      }

      .print-card-value {
        font-size: 16pt !important;
        font-weight: 700 !important;
        color: #8C6B2A !important;
      }
    }

    @media screen {
      .print-only {
        display: none !important;
      }
    }
  `;

  const allOutlets = useMemo(
    () => reportOutletRows.filter((row) => canAccessOutlet(currentUser, row.name, outletGroups)),
    [currentUser, outletGroups, reportOutletRows]
  );
  const roomOutletCount = allOutlets.filter((outlet) => outletGroup(outlet) === "rooms").length;
  const diningOutletCount = allOutlets.filter((outlet) => outletGroup(outlet) === "dining").length;
  const outletSections = useMemo(() => {
    const order = ["Main Wing", "Tower Wing", "Dining"];
    const sections = order.map((wing) => ({
      wing,
      rows: filteredOutlets.filter((outlet) => (outlet.wing || "Main Wing") === wing),
    }));
    const known = new Set(order);
    const extras = filteredOutlets.filter((outlet) => !known.has(outlet.wing || "Main Wing"));
    return [...sections, ...(extras.length ? [{ wing: "Other", rows: extras }] : [])].filter((section) => section.rows.length > 0);
  }, [filteredOutlets]);
  const outletOptions = useMemo(
    () => allOutlets.map((outlet) => canonicalOutletName(outlet.name)),
    [allOutlets]
  );

  useEffect(() => {
    if (selectedOutlet === "ALL") return;
    const tree = buildDynamicOutletTree(venueRows);
    const validParents = new Set([
      ...tree.map((g) => g.label.toLowerCase()),
      ...tree.flatMap((g) => g.sections.map((s) => s.label.toLowerCase())),
    ]);
    const normalizedSelected = canonicalOutletName(selectedOutlet).toLowerCase();
    if (!outletOptions.includes(canonicalOutletName(selectedOutlet)) && !validParents.has(normalizedSelected)) {
      setSelectedOutlet("ALL");
    }
  }, [outletOptions, selectedOutlet, venueRows]);

  useEffect(() => {
    if (selectedOutletGroup === "dining" && diningOutletCount === 0) setSelectedOutletGroup("all");
    if (selectedOutletGroup === "rooms" && roomOutletCount === 0) setSelectedOutletGroup("all");
  }, [diningOutletCount, roomOutletCount, selectedOutletGroup]);
  const transactionSummary = transactionReport.summary || {};
  const dateRangeLabel = `${readableDate(startDate)} to ${readableDate(endDate)}`;
  const isTrendTab = activeTab === "monthly" || activeTab === "yearly";
  const showOutletFilter = activeTab === "summary" || activeTab === "outlets";
  const currentYear = Number(today().slice(0, 4));
  const yearOptions = Array.from({ length: 6 }, (_, index) => currentYear - 3 + index);
  const monthSelectOptions = monthOptions();
  const selectedMonthLabel = monthlyReport.selected_month?.label || monthLabel(reportMonth, reportYear);
  const trendFilterDescription = activeTab === "monthly"
    ? "Monthly Performance focuses on one selected month. Use Daily or Weekly to change the activity grouping."
    : "Yearly reports use Jan-Dec to show annual seasonality and peak business periods.";
  const trendFilterBadge = activeTab === "monthly" ? "Month" : "Year";
  const compileCsvData = () => {
    if (csvExportType === "raw") {
      // Flat spreadsheet of reservations matching date/outlet filters (Excel BI style)
      const headers = [
        "Reference Code",
        "Guest Name",
        "Email",
        "Phone",
        "Outlet (Parent)",
        "Assigned Subroom (Child)",
        "Allocation Status",
        "Event Date",
        "Event Time",
        "Guests Count",
        "Status",
        "Type",
        "Table Number",
        "Seat Number",
        "Special Requests",
        "Submitted At",
        "Approved By",
        "Rejected By",
        "Cancelled By",
        "Last Action By",
        "Last Action Date"
      ];

      const filteredRes = reservations.filter(r => {
        if (startDate && r.event_date < startDate) return false;
        if (endDate && r.event_date > endDate) return false;
        if (selectedOutlet !== "ALL") {
          const canonicalSelected = canonicalOutletName(selectedOutlet);
          const resRoom = r.internal_room_name || r.room || r.venue?.name || "";
          const children = resolveOutletChildren(selectedOutlet, venueRows);
          const childrenSet = new Set(children.map(canonicalOutletName));
          const canonicalResRoom = canonicalOutletName(resRoom);
          if (canonicalResRoom !== canonicalSelected && !childrenSet.has(canonicalResRoom)) return false;
        }
        return true;
      });

      const dataRows = filteredRes.map(r => [
        r.reference_code || "-",
        r.name || r.guest_name || "-",
        r.email || "-",
        r.phone || "-",
        r.room || r.venue?.name || "-",
        r.internal_room_name || "Whole Venue",
        r.assignment_status || "pending",
        r.event_date || "-",
        r.event_time || "-",
        r.guests_count || 0,
        r.status || "pending",
        r.type || "Room/Table",
        r.table_number || "-",
        r.seat_number || "-",
        r.special_requests || "-",
        r.submitted_at || r.created_at || "-",
        r.approved_by || "-",
        r.rejected_by || "-",
        r.cancelled_by || "-",
        r.last_action_by || "-",
        r.last_action_date || "-"
      ]);

      return csvIncludeHeaders ? [headers, ...dataRows] : dataRows;
    } else {
      // Unified executive multi-table view
      const rows = [];

      if (csvIncludeHeaders) {
        rows.push(["=================================================="]);
        rows.push(["BELLEVUE OUTLET & ROOM PERFORMANCE REPORT"]);
        rows.push(["Generated At", new Date().toLocaleString()]);
        rows.push(["Date Range", dateRangeLabel]);
        rows.push(["Format Style", "Unified Executive View"]);
        rows.push(["=================================================="]);
        rows.push([]);
      }

      if (csvSections.summary) {
        rows.push(["OVERVIEW SUMMARY"]);
        rows.push(["Reservations Total", summary.reservations || 0]);
        rows.push(["Guests Total", summary.guests || 0]);
        rows.push(["Outlets Configured", summary.outlets || 0]);
        rows.push(["Transactions Tracked", transactionSummary.transactions || 0]);
        rows.push([]);
      }

      if (csvSections.status) {
        rows.push(["STATUS BREAKDOWN"]);
        rows.push(["Reserved/Approved", reservedCount]);
        rows.push(["Pending Coordination", statuses.pending || 0]);
        rows.push(["Rejected/Declined", statuses.rejected || 0]);
        rows.push(["Cancelled", statuses.cancelled || 0]);
        rows.push([]);
      }

      if (csvSections.trends) {
        rows.push(["ANNUAL PERFORMANCE TRENDS"]);
        rows.push(["Month", "Reservations", "Promotion Mentions"]);
        (monthlyReport.months || []).forEach((month) => {
          rows.push([month.label, month.reservations || 0, month.promotion_mentions || 0]);
        });
        rows.push([]);

        rows.push([`${selectedMonthLabel} ${monthlyGranularity === "weekly" ? "Weekly" : "Daily"} Activity`]);
        rows.push(["Label", "Reservations", "Promotion Mentions"]);
        ((monthlyGranularity === "weekly" ? monthlyReport.selected_month?.weeks : monthlyReport.selected_month?.days) || []).forEach((row) => {
          rows.push([row.label, row.reservations || 0, row.promotion_mentions || 0]);
        });
        rows.push([]);
      }

      if (csvSections.outlets) {
        rows.push(["OUTLET PERFORMANCE DETAILS"]);
        rows.push(["Outlet", "Wing", "Type", "Reservations", "Guests", "Reserved", "Pending", "Rejected", "Cancelled", "Dine-In", "Promo"]);
        filteredOutlets.forEach((outlet) => {
          rows.push([
            outlet.name,
            outlet.wing || "Main Wing",
            outlet.type || "Outlet",
            outlet.total_reservations || 0,
            outlet.guests || 0,
            outlet.reserved || 0,
            outlet.pending || 0,
            outlet.rejected || 0,
            outlet.cancelled || 0,
            outlet.dine_in || 0,
            outlet.promotion_mentions || 0,
          ]);
        });
        rows.push([]);
      }

      if (csvSections.rooms) {
        rows.push(["ROOM DETAILS PERFORMANCE"]);
        rows.push(["Room / Outlet", "Reservations", "Guests", "Pending", "Reserved", "Rejected", "Cancelled", "Dine-In", "Promo", "Latest Event"]);
        roomDetails.forEach((room) => {
          rows.push([
            room.room,
            room.reservations || 0,
            room.guests || 0,
            room.pending || 0,
            room.reserved || 0,
            room.rejected || 0,
            room.cancelled || 0,
            room.dine_in || 0,
            room.promotion_mentions || 0,
            room.latest_event_date || "-",
          ]);
        });
        rows.push([]);
      }

      return rows;
    }
  };

  const handleExportCsv = () => {
    downloadCsv(csvFilename, compileCsvData(), csvDelimiter);
    setShowCsvConfig(false);
  };
  const reportGroups = [
    {
      label: "Overview Analytics",
      description: "Date-range reports for operational review.",
      tabs: [
        { id: "summary", label: "Summary" },
        { id: "outlets", label: "Outlets" },
      ],
    },
    {
      label: "Trend Analytics",
      description: "Month-focused operations and annual seasonality.",
      tabs: [
        { id: "monthly", label: "Monthly Performance" },
        { id: "yearly", label: "Yearly Trends" },
      ],
    },
    ...(canViewTransactions
      ? [{
        label: "System Monitoring",
        description: "Date-range audit records and status activity.",
        tabs: [{ id: "audit", label: "Audit Trail" }],
      }]
      : []),
  ];
  const activeReport = reportGroups.flatMap((group) => group.tabs).find((tab) => tab.id === activeTab);
  const filterModeLabel = activeTab === "monthly"
    ? `${selectedMonthLabel} ${monthlyGranularity} activity`
    : isTrendTab ? `${reportYear} annual trend reporting` : `${dateRangeLabel} date range`;

  return (
    <div className="reports-main-container" style={{ minHeight: "100vh", background: C.page, fontFamily: F.body }}>
      <style>{`
        @keyframes reportsFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .reports-section {
          animation: reportsFadeIn 0.22s ease both;
        }
        .reports-table-row {
          transition: background 0.14s ease;
          cursor: pointer;
        }
        .reports-table-row:hover {
          background: rgba(140,107,42,0.035);
        }
        @media (max-width: 980px) {
          .reports-top, .reports-grid, .reports-toolbar, .reports-nav-grid { grid-template-columns: 1fr !important; }
          .reports-filter-panel { min-width: 0 !important; }
        }
      `}</style>
      <style>{printStyles}</style>
      <div className="print-exclude" style={{ display: "flex", flexDirection: "column", height: "100vh", minHeight: 0, overflow: "hidden" }}>
        <AdminNavbar />
        <div style={{ display: "flex", height: "calc(100vh - 60px)", minHeight: 0, overflow: "hidden" }}>
          <Sidebar activeNav="reports" isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
          <main style={{ flex: 1, height: "calc(100vh - 60px)", overflow: "auto", padding: "30px 32px 42px" }}>
            <AdminPageHeader
              eyebrow="Reports"
              title="Outlet Performance"
              description={canViewReports ? `${activeReport?.label || "Reports"} uses ${filterModeLabel}.` : "Performance reporting and export tools for authorized administrators."}
              C={C}
              F={F}
              actions={canViewReports && (
                <div className="reports-toolbar print-exclude" style={{ display: "flex", alignItems: "flex-end", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {activeTab === "monthly" ? (
                    <>
                      <FilterField label="Month">
                        <select value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} style={filterStyle()}>
                          {monthSelectOptions.map((month) => <option key={month.value} value={month.value}>{month.label}</option>)}
                        </select>
                      </FilterField>
                      <FilterField label="Year">
                        <select value={reportYear} onChange={(e) => setReportYear(e.target.value)} style={filterStyle()}>
                          {yearOptions.map((year) => <option key={year} value={String(year)}>{year}</option>)}
                        </select>
                      </FilterField>
                      <FilterField label="Group By">
                        <div style={{ display: "flex", height: 34, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", background: C.surface }}>
                          {["daily", "weekly"].map((mode) => {
                            const active = monthlyGranularity === mode;
                            return (
                              <button
                                key={mode}
                                type="button"
                                onClick={() => setMonthlyGranularity(mode)}
                                style={{
                                  border: "none",
                                  borderRight: mode === "daily" ? `1px solid ${C.border}` : "none",
                                  background: active ? C.goldFaint : "transparent",
                                  color: active ? C.gold : C.muted,
                                  padding: "0 10px",
                                  fontFamily: F.label,
                                  fontSize: 10,
                                  fontWeight: 700,
                                  letterSpacing: "0.08em",
                                  textTransform: "uppercase",
                                  cursor: "pointer",
                                }}
                              >
                                {mode}
                              </button>
                            );
                          })}
                        </div>
                      </FilterField>
                    </>
                  ) : activeTab === "yearly" ? (
                    <FilterField label="Report Year">
                      <select value={reportYear} onChange={(e) => setReportYear(e.target.value)} style={filterStyle()}>
                        {yearOptions.map((year) => <option key={year} value={String(year)}>{year}</option>)}
                      </select>
                    </FilterField>
                  ) : (
                    <>
                      <FilterField label="Preset">
                        <select value={datePreset} onChange={(e) => handleDatePresetChange(e.target.value)} style={filterStyle()}>
                          <option value="custom">Custom Range</option>
                          <option value="today">Today</option>
                          <option value="yesterday">Yesterday</option>
                          <option value="this_week">This Week</option>
                          <option value="last_7">Last 7 Days</option>
                          <option value="this_month">This Month</option>
                          <option value="last_30">Last 30 Days</option>
                          <option value="ytd">Year to Date</option>
                        </select>
                      </FilterField>
                      {showOutletFilter && (
                        <FilterField label="Outlet">
                          <select value={selectedOutlet} onChange={(e) => setSelectedOutlet(e.target.value)} style={filterStyle()}>
                            <option value="ALL">All outlets</option>
                            {buildDynamicOutletTree(venueRows).flatMap((group) => {
                              const groupOptions = [];
                              const groupAccessible = group.sections.some((sec) =>
                                sec.items.some((item) => allOutlets.some((out) => canonicalOutletName(out.name) === canonicalOutletName(item)))
                              );
                              if (!groupAccessible) return [];

                              groupOptions.push(
                                <option key={group.id} value={group.label} style={{ fontWeight: "bold", color: "#8C6B2A" }}>
                                  -- {group.label} (All) --
                                </option>
                              );

                              group.sections.forEach((section) => {
                                const children = section.items.filter((item) =>
                                  allOutlets.some((out) => canonicalOutletName(out.name) === canonicalOutletName(item))
                                );
                                if (children.length === 0) return;

                                const hasChildren = section.items.length > 1;
                                if (hasChildren) {
                                  groupOptions.push(
                                    <option key={section.label} value={section.label} style={{ fontWeight: "600" }}>
                                      {section.label} (All)
                                    </option>
                                  );
                                  children.forEach((item) => {
                                    if (item !== section.label) {
                                      groupOptions.push(
                                        <option key={item} value={item}>
                                          {"\u00A0\u00A0\u00A0\u00A0" + item}
                                        </option>
                                      );
                                    }
                                  });
                                } else {
                                  groupOptions.push(
                                    <option key={section.label} value={section.label}>
                                      {section.label}
                                    </option>
                                  );
                                }
                              });

                              return groupOptions;
                            })}
                          </select>
                        </FilterField>
                      )}
                      <FilterField label="Start">
                        <input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); setDatePreset("custom"); }} style={filterStyle()} />
                      </FilterField>
                      <FilterField label="End">
                        <input type="date" value={endDate} onChange={(e) => { setEndDate(e.target.value); setDatePreset("custom"); }} style={filterStyle()} />
                      </FilterField>
                    </>
                  )}

                  <button
                    onClick={loadReport}
                    disabled={loading}
                    style={{
                      height: 34,
                      padding: "0 16px",
                      border: "none",
                      borderRadius: 8,
                      background: C.gold,
                      color: "#fff",
                      fontFamily: F.label,
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      textTransform: "uppercase",
                      cursor: loading ? "not-allowed" : "pointer",
                      transition: "background 0.12s",
                    }}
                  >
                    {loading ? "..." : "Apply"}
                  </button>
                  <ActionButton
                    icon={Download}
                    label="CSV"
                    onClick={() => {
                      const trendName = activeTab === "monthly"
                        ? `outlet-report-${reportYear}-${String(reportMonth).padStart(2, "0")}-${monthlyGranularity}.csv`
                        : `outlet-report-${reportYear}.csv`;
                      const defaultFilename = isTrendTab ? trendName : `outlet-report-${startDate}-to-${endDate}.csv`;
                      setCsvFilename(defaultFilename);
                      setShowCsvConfig(true);
                    }}
                  />
                  <ActionButton icon={Printer} label="Print" onClick={() => setShowPrintConfig(true)} />
                </div>
              )}
            />

            {!canViewReports ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 22, color: C.muted }}>
                Your account can access admin pages, but does not have report visibility.
              </div>
            ) : error ? (
              <div style={{ background: C.redFaint, border: "1px solid rgba(160,56,56,0.18)", borderRadius: 10, padding: 14, color: C.red }}>{error}</div>
            ) : loading ? (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 28, color: C.muted }}>Loading reports...</div>
            ) : (
              <div style={{ display: "grid", gap: 22 }}>
                <ReportTabs groups={reportGroups} activeTab={activeTab} onChange={setActiveTab} />

                <div key={activeTab} className="reports-section" style={{ display: "grid", gap: 22 }}>
                  {activeTab === "summary" && (
                    <>
                      <div className="print-overview">
                        <Section title="Overview" subtitle="High-level submission activity for the selected date range.">
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
                            <MetricCard label="Reservations" value={filteredSummary.reservations || 0} tone="blue" />
                            <MetricCard label="Guests" value={filteredSummary.guests || 0} tone="green" />
                            <MetricCard label="Outlets" value={selectedOutlet === "ALL" ? (summary.outlets || 0) : filteredOutlets.length} tone="gold" />
                            <MetricCard label="Transactions" value={transactionSummary.transactions || 0} detail={canViewTransactions ? "read-only" : ""} tone="slate" />
                          </div>
                        </Section>
                      </div>

                      <div className="reports-grid print-mix" style={{ display: "grid", gridTemplateColumns: "minmax(280px,1.05fr) minmax(280px,0.95fr)", gap: 14 }}>
                        <SummaryPanel title="Reservation Status">
                          <DonutChart counts={{ ...filteredSummary, declined: filteredSummary.rejected }} total={filteredSummary.reservations} />
                        </SummaryPanel>

                        <SummaryPanel title="Reservation Mix">
                          <div style={{ display: "grid", gap: 12, padding: "8px 16px" }}>
                            <ProgressRow label="Dine-In Outlets" value={filteredCategory.dine_in?.reservations || 0} total={filteredSummary.reservations} tone="green" />
                            <ProgressRow label="Room Service / Tables" value={filteredCategory.room_reservations?.reservations || 0} total={filteredSummary.reservations} tone="gold" />
                            <ProgressRow label="Promotion Mentions" value={filteredCategory.promotion_mentions?.reservations || 0} total={filteredSummary.reservations} tone="blue" />
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 8, borderTop: `1px solid ${C.divider}`, paddingTop: 10 }}>
                              <div style={{ fontSize: 11, color: C.muted }}>Dine-In: <strong style={{ color: C.text }}>{filteredCategory.dine_in?.guests || 0}</strong> guests</div>
                              <div style={{ fontSize: 11, color: C.muted }}>Rooms: <strong style={{ color: C.text }}>{filteredCategory.room_reservations?.guests || 0}</strong> guests</div>
                            </div>
                          </div>
                        </SummaryPanel>
                      </div>
                    </>
                  )}

                  {activeTab === "monthly" && (
                    <div className="print-trends">
                      <Section title="Monthly Performance" subtitle={`Showing reservation activity for ${selectedMonthLabel}. Switch between daily precision and weekly summaries for operational review.`}>
                        <MonthlyReports monthlyReport={monthlyReport} granularity={monthlyGranularity} monthLabelText={selectedMonthLabel} />
                      </Section>
                    </div>
                  )}

                  {activeTab === "yearly" && (
                    <div className="print-trends">
                      <Section title="Yearly Trends" subtitle={`Annual Jan-Dec overview for ${reportYear}, showing seasonality, reservation distribution, and peak business periods.`}>
                        <YearlyReports monthlyReport={monthlyReport} transactionSummary={transactionSummary} />
                      </Section>
                    </div>
                  )}

                  {activeTab === "outlets" && (
                    <Section title="Outlet Performance" subtitle="Grouped by outlet type. Use the filters and sort dropdowns to inspect rooms, dining outlets, and exact room totals.">
                      <div style={{ display: "grid", gap: 14 }}>
                        <ReportCard style={{ padding: 12 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", flex: 1, minWidth: 280 }}>
                              <FilterChip icon={Layers} label="All" count={allOutlets.length} active={selectedOutletGroup === "all"} onClick={() => setSelectedOutletGroup("all")} />
                              {roomOutletCount > 0 && <FilterChip icon={Building2} label="Rooms" count={roomOutletCount} active={selectedOutletGroup === "rooms"} onClick={() => setSelectedOutletGroup("rooms")} />}
                              {diningOutletCount > 0 && <FilterChip icon={Utensils} label="Dining" count={diningOutletCount} active={selectedOutletGroup === "dining"} onClick={() => setSelectedOutletGroup("dining")} />}
                            </div>
                            <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                              {/* Search */}
                              <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "0 10px", height: 34 }}>
                                <Search size={13} style={{ color: C.muted }} />
                                <input
                                  type="text"
                                  value={outletSearchQuery}
                                  onChange={(e) => setOutletSearchQuery(e.target.value)}
                                  placeholder="Search outlets..."
                                  style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, color: C.text, width: 140, fontFamily: F.body }}
                                />
                              </div>

                              {/* Subtle integrated Grid/List view switcher */}
                              <div style={{ display: "inline-flex", height: 34, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", background: C.surface }}>
                                {[
                                  ["grid", <LayoutGrid size={15} />],
                                  ["list", <List size={15} />],
                                ].map(([mode, icon]) => {
                                  const active = outletViewMode === mode;
                                  return (
                                    <button
                                      key={mode}
                                      type="button"
                                      onClick={() => setOutletViewMode(mode)}
                                      style={{
                                        border: "none",
                                        borderRight: mode === "grid" ? `1px solid ${C.border}` : "none",
                                        background: active ? C.goldFaint : "transparent",
                                        color: active ? C.gold : C.muted,
                                        padding: "0 12px",
                                        display: "grid",
                                        placeItems: "center",
                                        cursor: "pointer",
                                        transition: "background 0.12s, color 0.12s",
                                      }}
                                    >
                                      {icon}
                                    </button>
                                  );
                                })}
                              </div>

                              <SortSelect value={outletSort} options={SORT_OPTIONS.outlets} onChange={setOutletSort} />
                            </div>
                          </div>
                        </ReportCard>

                        {outletViewMode === "grid" ? (
                          <div className="print-outlets" style={{ display: "grid", gap: 16 }}>
                            {outletSections.map((section) => (
                              <div key={section.wing} style={{ display: "grid", gap: 10 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 750, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold }}>{section.wing}</div>
                                  <div style={{ height: 1, background: C.divider, flex: 1 }} />
                                  <div style={{ color: C.faint, fontSize: 11, fontWeight: 650 }}>{section.rows.length} outlet{section.rows.length === 1 ? "" : "s"}</div>
                                </div>
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%, 300px),1fr))", gap: 12 }}>
                                  {section.rows.map((outlet) => (
                                    <OutletCard
                                      key={outlet.name || outlet.venue_id}
                                      outlet={outlet}
                                      onSelect={() => setActiveOutletDetails(outlet.name)}
                                    />
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <TableCard
                            title="Outlet Performance Ledger"
                            headers={["Outlet Name", "Wing Location", "Venue Type", "Total Bookings", "Guests", "Reserved", "Pending", "Rejected", "Acceptance Rate"]}
                            rows={filteredOutlets}
                            renderRow={(outlet) => (
                              <tr key={outlet.name || outlet.venue_id} className="reports-table-row" onClick={() => setActiveOutletDetails(outlet.name)}>
                                <td style={cellStyle(true)}>{outlet.name}</td>
                                <td style={cellStyle()}>{outlet.wing || "Main Wing"}</td>
                                <td style={cellStyle()}>{outlet.type || "Outlet"}</td>
                                <td style={cellStyle(true)}>{outlet.total_reservations || 0}</td>
                                <td style={cellStyle()}>{outlet.guests || 0}</td>
                                <td style={cellStyle()}><span style={{ color: C.green, fontWeight: 600 }}>{outlet.reserved || 0}</span></td>
                                <td style={cellStyle()}><span style={{ color: C.gold, fontWeight: 600 }}>{outlet.pending || 0}</span></td>
                                <td style={cellStyle()}><span style={{ color: C.red, fontWeight: 600 }}>{outlet.rejected || 0}</span></td>
                                <td style={cellStyle()}>
                                  <span style={{ padding: "3px 7px", borderRadius: 999, background: C.goldFaint, color: C.gold, fontSize: 10, fontWeight: 700 }}>
                                    {outlet.acceptance_rate}%
                                  </span>
                                </td>
                              </tr>
                            )}
                          />
                        )}

                        <div className="print-rooms" style={{ display: "grid", gap: 14, marginTop: 24 }}>
                          {/* Section Separator */}
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ fontFamily: F.label, fontSize: 10.5, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>Room Totals</div>
                            <div style={{ height: 1, background: C.divider, flex: 1 }} />
                            <div style={{ color: C.faint, fontSize: 11, fontWeight: 650 }}>{roomDetails.length} room record{roomDetails.length === 1 ? "" : "s"}</div>
                          </div>

                          {/* Room Totals Toolbar Card */}
                          <ReportCard style={{ padding: 12 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", flex: 1, minWidth: 280 }}>
                                {/* Search */}
                                <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 8, padding: "0 10px", height: 34 }}>
                                  <Search size={13} style={{ color: C.muted }} />
                                  <input
                                    type="text"
                                    value={roomSearchQuery}
                                    onChange={(e) => setRoomSearchQuery(e.target.value)}
                                    placeholder="Search rooms..."
                                    style={{ border: "none", outline: "none", background: "transparent", fontSize: 12, color: C.text, width: 140, fontFamily: F.body }}
                                  />
                                </div>

                                {/* View switcher */}
                                <div style={{ display: "inline-flex", height: 34, border: `1px solid ${C.border}`, borderRadius: 8, overflow: "hidden", background: C.surface }}>
                                  {[
                                    ["grid", <LayoutGrid size={14} />],
                                    ["list", <List size={14} />],
                                  ].map(([mode, icon]) => {
                                    const active = roomViewMode === mode;
                                    return (
                                      <button
                                        key={mode}
                                        type="button"
                                        onClick={() => { setRoomPage(1); setRoomViewMode(mode); }}
                                        style={{
                                          border: "none",
                                          borderRight: mode === "grid" ? `1px solid ${C.border}` : "none",
                                          background: active ? C.goldFaint : "transparent",
                                          color: active ? C.gold : C.muted,
                                          padding: "0 12px",
                                          display: "grid",
                                          placeItems: "center",
                                          cursor: "pointer",
                                          transition: "background 0.12s, color 0.12s",
                                        }}
                                      >
                                        {icon}
                                      </button>
                                    );
                                  })}
                                </div>

                                <span style={{ fontSize: 12, color: C.muted, marginLeft: 8 }}>
                                  Showing <strong style={{ color: C.text }}>{roomDetails.length === 0 ? 0 : (roomPage - 1) * roomRowsPerPage + 1}-{Math.min(roomPage * roomRowsPerPage, roomDetails.length)}</strong> of <strong style={{ color: C.text }}>{roomDetails.length}</strong>
                                </span>
                              </div>

                              <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
                                {/* Rows Select */}
                                <FilterField label="Show Rows">
                                  <select
                                    value={roomRowsPerPage}
                                    onChange={(e) => setRoomRowsPerPage(Number(e.target.value))}
                                    style={{ ...filterStyle(), minWidth: 110 }}
                                  >
                                    {[10, 25, 50, 100].map((val) => (
                                      <option key={val} value={val}>{val} entries</option>
                                    ))}
                                    <option value={999999}>All entries</option>
                                  </select>
                                </FilterField>

                                {/* Sort Select */}
                                <FilterField label="Sort By">
                                  <select
                                    value={sortValue(roomSort)}
                                    onChange={(event) => setRoomSort(sortFromValue(event.target.value))}
                                    style={{ ...filterStyle(), minWidth: 190 }}
                                  >
                                    {SORT_OPTIONS.rooms.map((option) => (
                                      <option key={option.value} value={option.value}>{option.label}</option>
                                    ))}
                                  </select>
                                </FilterField>
                              </div>
                            </div>
                          </ReportCard>

                          {/* Content block: List or Grid */}
                          {roomViewMode === "list" ? (
                            <TableCard
                              title="Room Registry"
                              headers={["Room / Outlet", "Reservations", "Guests", "Pending", "Reserved", "Rejected", "Cancelled", "Dine-In", "Promo", "Latest Event"]}
                              rows={visibleRoomRows}
                              renderRow={(room) => (
                                <tr key={room.room} className="reports-table-row" onClick={() => setActiveOutletDetails(room.room)}>
                                  <td style={cellStyle(true)}>{room.room}</td>
                                  <td style={cellStyle()}>{room.reservations}</td>
                                  <td style={cellStyle()}>{room.guests}</td>
                                  <td style={cellStyle()}><span style={{ color: C.gold, fontWeight: 600 }}>{room.pending}</span></td>
                                  <td style={cellStyle()}><span style={{ color: C.green, fontWeight: 600 }}>{room.reserved}</span></td>
                                  <td style={cellStyle()}><span style={{ color: C.red, fontWeight: 600 }}>{room.rejected}</span></td>
                                  <td style={cellStyle()}>{room.cancelled}</td>
                                  <td style={cellStyle()}>{room.dine_in}</td>
                                  <td style={cellStyle()}>{room.promotion_mentions}</td>
                                  <td style={cellStyle()}>{room.latest_event_date || "-"}</td>
                                </tr>
                              )}
                              footer={
                                <div style={{ padding: "11px 14px", borderTop: `1px solid ${C.divider}`, background: C.soft, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", color: C.muted, fontSize: 12 }}>
                                  <span>
                                    Page {roomPage} of {totalRoomPages}
                                  </span>
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <button
                                      type="button"
                                      onClick={() => setRoomPage((current) => Math.max(1, current - 1))}
                                      disabled={roomPage === 1}
                                      style={{ ...pagerButtonStyle(), height: 30, opacity: roomPage === 1 ? 0.45 : 1, cursor: roomPage === 1 ? "not-allowed" : "pointer" }}
                                    >
                                      Previous
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setRoomPage((current) => Math.min(totalRoomPages, current + 1))}
                                      disabled={roomPage === totalRoomPages}
                                      style={{ ...pagerButtonStyle(), height: 30, opacity: roomPage === totalRoomPages ? 0.45 : 1, cursor: roomPage === totalRoomPages ? "not-allowed" : "pointer" }}
                                    >
                                      Next
                                    </button>
                                  </div>
                                </div>
                              }
                            />
                          ) : (
                            <ReportCard style={{ overflow: "hidden", minWidth: 0 }}>
                              <div style={{ padding: 16 }}>
                                {roomDetails.length === 0 ? (
                                  <div style={{ padding: "16px 12px", color: C.muted, fontSize: 12.5 }}>No records found.</div>
                                ) : (
                                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%, 300px),1fr))", gap: 12 }}>
                                    {visibleRoomRows.map((room) => (
                                      <RoomGridCard key={room.room} room={room} onSelect={() => setActiveOutletDetails(room.room)} />
                                    ))}
                                  </div>
                                )}
                              </div>
                              <div style={{ padding: "11px 14px", borderTop: `1px solid ${C.divider}`, background: C.soft, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap", color: C.muted, fontSize: 12 }}>
                                <span>
                                  Page {roomPage} of {totalRoomPages}
                                </span>
                                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <button
                                    type="button"
                                    onClick={() => setRoomPage((current) => Math.max(1, current - 1))}
                                    disabled={roomPage === 1}
                                    style={{ ...pagerButtonStyle(), height: 30, opacity: roomPage === 1 ? 0.45 : 1, cursor: roomPage === 1 ? "not-allowed" : "pointer" }}
                                  >
                                    Previous
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setRoomPage((current) => Math.min(totalRoomPages, current + 1))}
                                    disabled={roomPage === totalRoomPages}
                                    style={{ ...pagerButtonStyle(), height: 30, opacity: roomPage === totalRoomPages ? 0.45 : 1, cursor: roomPage === totalRoomPages ? "not-allowed" : "pointer" }}
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                            </ReportCard>
                          )}
                        </div>
                      </div>
                    </Section>
                  )}

                  {activeTab === "audit" && canViewTransactions && (
                    <div className="print-audit">
                      <Section title="Audit Trail" subtitle="Read-only status changes for operational review.">
                        <TransactionMonitor transactionReport={transactionReport} isGlobal={canViewGlobalReports} sort={auditSort} onSort={setAuditSort} />
                      </Section>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      {/* 1. Print Config Customizer Panel with Live Preview */}
      {showPrintConfig && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(24,20,14,0.42)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 20 }} className="print-exclude">
          <section style={{ width: "min(1200px, 95vw)", height: "calc(100vh - 40px)", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 26px 70px rgba(24,20,14,0.24)", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: F.body }}>
            {/* Header */}
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold }}>Interactive Print & PDF Suite</div>
                <div style={{ marginTop: 4, fontSize: 12.5, color: C.muted }}>Configure pagination, scale factors, and orientations with live document layout preview.</div>
              </div>
              <button
                type="button"
                onClick={() => setShowPrintConfig(false)}
                style={{ border: "none", background: "transparent", color: C.muted, fontSize: 20, cursor: "pointer", fontWeight: 300, padding: 8 }}
              >
                ✕
              </button>
            </div>

            {/* Split Content Area */}
            <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
              {/* Left Config Column */}
              <div style={{ width: 380, borderRight: `1px solid ${C.divider}`, padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, minWidth: 380 }}>
                {/* General or Custom selector */}
                <div style={{ display: "grid", gap: 14 }}>
                  <FilterField label="Report Type">
                    <select value={printReportType} onChange={(e) => handlePrintReportTypeChange(e.target.value)} style={{ ...filterStyle(), width: "100%" }}>
                      <option value="general">General Executive Report (All Sections)</option>
                      <option value="custom">Custom Report (Choose below)</option>
                    </select>
                  </FilterField>
                </div>

                <div style={{ height: 1, background: C.divider }} />

                {/* Sections to Print */}
                <div style={{ display: "grid", gap: 10 }}>
                  <div style={{ fontFamily: F.label, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: C.faint }}>Select Sections to Include</div>
                  <div style={{ display: "grid", gap: 8 }}>
                    {Object.keys(printSections).map((sec) => (
                      <label key={sec} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.text, cursor: "pointer", padding: "4px 0" }}>
                        <input
                          type="checkbox"
                          checked={printSections[sec]}
                          onChange={(e) => handleSectionCheckboxChange(sec, e.target.checked)}
                          style={{ width: 17, height: 17, accentColor: C.gold }}
                        />
                        <span style={{ textTransform: "capitalize", fontWeight: 550 }}>
                          {sec === "mix" ? "Distribution & status mix" : sec === "trends" ? "Granular trends & charts" : sec}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div style={{ height: 1, background: C.divider }} />

                {/* Sizing & Layout Options */}
                <div style={{ display: "grid", gap: 14 }}>
                  <div style={{ fontFamily: F.label, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: C.faint }}>Document Layout Settings</div>

                  <FilterField label="Orientation style">
                    <select value={printOrientation} onChange={(e) => setPrintOrientation(e.target.value)} style={{ ...filterStyle(), width: "100%" }}>
                      <option value="portrait">Portrait (Vertical)</option>
                      <option value="landscape">Landscape (Horizontal)</option>
                    </select>
                  </FilterField>

                  <FilterField label="Paper size standard">
                    <select value={printPageSize} onChange={(e) => setPrintPageSize(e.target.value)} style={{ ...filterStyle(), width: "100%" }}>
                      <option value="a4">A4 (210mm x 297mm)</option>
                      <option value="letter">US Letter (8.5" x 11")</option>
                    </select>
                  </FilterField>

                  <FilterField label="Typography font scale size">
                    <select value={printFontScale} onChange={(e) => setPrintFontScale(e.target.value)} style={{ ...filterStyle(), width: "100%" }}>
                      <option value="small">Small size (85% scaling)</option>
                      <option value="medium">Medium size (100% standard)</option>
                      <option value="large">Large size (115% high-readability)</option>
                    </select>
                  </FilterField>
                </div>
              </div>

              {/* Right Live Preview Column */}
              <div style={{ flex: 1, background: "#FAF8F4", borderLeft: `1px solid ${C.border}`, padding: "30px 20px", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", minWidth: 0 }}>
                <div style={{ fontFamily: F.label, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold, marginBottom: 16 }}>Live Layout Preview</div>

                {/* Paper sheet container */}
                <div
                  style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 8,
                    boxShadow: "0 8px 30px rgba(24,20,14,0.06)",
                    padding: "30px 24px",
                    width: printOrientation === "landscape" ? "100%" : "min(580px, 100%)",
                    maxWidth: printOrientation === "landscape" ? "800px" : "580px",
                    aspectRatio: printOrientation === "landscape" ? "1.414 / 1" : "1 / 1.414",
                    minHeight: printOrientation === "landscape" ? "540px" : "760px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 16,
                    overflowY: "auto",
                    fontSize: printFontScale === "small" ? 11 : printFontScale === "large" ? 13.5 : 12,
                    boxSizing: "border-box",
                  }}
                >
                  {/* Preview Paper Header */}
                  <div style={{ borderBottom: `2px solid ${C.gold}`, paddingBottom: 10, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexShrink: 0 }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.text, letterSpacing: "0.06em", textTransform: "uppercase" }}>The Bellevue Manila</div>
                      <div style={{ fontSize: 9.5, color: C.muted, marginTop: 2 }}>
                        Performance & Operational Report summary{selectedOutlet !== "ALL" && ` · Filtered by: ${selectedOutlet}`}
                      </div>
                    </div>
                    <div style={{ fontSize: 9.5, color: C.gold, fontWeight: 700 }}>{dateRangeLabel}</div>
                  </div>

                  {/* Preview Paper Content Blocks */}
                  <div style={{ display: "grid", gap: 14, flex: 1, overflowY: "auto", paddingRight: 4 }}>
                    {/* Mock Overview */}
                    {printSections.overview && (
                      <div style={{ border: `1px solid ${C.divider}`, borderRadius: 8, padding: 10, background: C.soft }}>
                        <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: C.gold, marginBottom: 6 }}>Overview Metrics</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                          {[
                            ["Reservations", filteredSummary.reservations || 0],
                            ["Guests", filteredSummary.guests || 0],
                            ["Outlets", selectedOutlet === "ALL" ? (summary.outlets || 0) : filteredOutlets.length],
                            ["Transactions", transactionSummary.transactions || 0],
                          ].map(([lbl, val]) => (
                            <div key={lbl} style={{ background: C.surface, padding: 6, borderRadius: 6, border: `1px solid ${C.divider}` }}>
                              <div style={{ fontSize: 8, color: C.faint, textTransform: "uppercase" }}>{lbl}</div>
                              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2, color: C.text }}>{val}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Mock Status Breakdown */}
                    {printSections.mix && (
                      <div style={{ border: `1px solid ${C.divider}`, borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: C.gold, marginBottom: 8 }}>Reservation status distribution</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div style={{ display: "grid", gap: 4 }}>
                            <ProgressRow label="Reserved" value={filteredSummary.reserved} total={filteredSummary.reservations} tone="green" />
                            <ProgressRow label="Pending" value={filteredSummary.pending} total={filteredSummary.reservations} tone="gold" />
                          </div>
                          <div style={{ display: "grid", gap: 4 }}>
                            <ProgressRow label="Rejected" value={filteredSummary.rejected} total={filteredSummary.reservations} tone="red" />
                            <ProgressRow label="Cancelled" value={filteredSummary.cancelled} total={filteredSummary.reservations} tone="slate" />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Mock Outlets */}
                    {printSections.outlets && (
                      <div style={{ border: `1px solid ${C.divider}`, borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: C.gold, marginBottom: 6 }}>Venue Performance Deck</div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                          {filteredOutlets.slice(0, 3).map((out) => (
                            <div key={out.name} style={{ background: C.soft, border: `1px solid ${C.divider}`, borderRadius: 6, padding: 6 }}>
                              <div style={{ fontSize: 9.5, fontWeight: 700, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{out.name}</div>
                              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 8.5, color: C.muted }}>
                                <span>Bookings: {out.total_reservations || 0}</span>
                                <span>{out.acceptance_rate}% approved</span>
                              </div>
                            </div>
                          ))}
                        </div>
                        {filteredOutlets.length > 3 && (
                          <div style={{ fontSize: 8.5, color: C.faint, marginTop: 4, textAlign: "right" }}>+ {filteredOutlets.length - 3} more outlets will print in full document page...</div>
                        )}
                      </div>
                    )}

                    {/* Mock Rooms */}
                    {printSections.rooms && (
                      <div style={{ border: `1px solid ${C.divider}`, borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: C.gold, marginBottom: 6 }}>Room totals performance listing</div>
                        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 9.5 }}>
                          <thead>
                            <tr style={{ background: C.soft, color: C.faint, textTransform: "uppercase", fontSize: 8 }}>
                              <th style={{ textAlign: "left", padding: "4px" }}>Room</th>
                              <th style={{ textAlign: "left", padding: "4px" }}>Bookings</th>
                              <th style={{ textAlign: "left", padding: "4px" }}>Guests</th>
                              <th style={{ textAlign: "left", padding: "4px" }}>Reserved</th>
                            </tr>
                          </thead>
                          <tbody>
                            {roomDetails.slice(0, 3).map((r) => (
                              <tr key={r.room} style={{ borderBottom: `1px solid ${C.divider}` }}>
                                <td style={{ padding: "4px", fontWeight: 650 }}>{r.room}</td>
                                <td style={{ padding: "4px" }}>{r.reservations}</td>
                                <td style={{ padding: "4px" }}>{r.guests}</td>
                                <td style={{ padding: "4px" }}>{r.reserved}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {roomDetails.length > 3 && (
                          <div style={{ fontSize: 8.5, color: C.faint, marginTop: 4, textAlign: "right" }}>+ {roomDetails.length - 3} more rooms will print in full document list...</div>
                        )}
                      </div>
                    )}

                    {/* Mock Trend Chart */}
                    {printSections.trends && (
                      <div style={{ border: `1px solid ${C.divider}`, borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: C.gold, marginBottom: 4 }}>Reservation density trends</div>
                        <div style={{ height: 40, border: `1px dashed ${C.border}`, borderRadius: 6, display: "grid", placeItems: "center", background: C.soft, color: C.muted, fontSize: 10 }}>
                          📊 Composed trend line visualization will render in full high-resolution printout
                        </div>
                      </div>
                    )}

                    {/* Mock Audit */}
                    {printSections.audit && (
                      <div style={{ border: `1px solid ${C.divider}`, borderRadius: 8, padding: 10 }}>
                        <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", color: C.gold, marginBottom: 4 }}>Audit trail transaction monitor logs</div>
                        <div style={{ fontSize: 9, color: C.muted }}>Transaction record logs (Time, Reference code, Coordinator action) will print as structured list pages at the end of the report document.</div>
                      </div>
                    )}
                  </div>

                  {/* Preview Footer */}
                  <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 6, display: "flex", justifyContent: "space-between", fontSize: 8.5, color: C.faint, flexShrink: 0 }}>
                    <span>Report size standard: {printPageSize.toUpperCase()} · {printOrientation.toUpperCase()}</span>
                    <span>Document Page 1 of 1 (Preview)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Actions Bar */}
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.divider}`, background: C.soft, display: "flex", justifyContent: "flex-end", gap: 12, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setShowPrintConfig(false)}
                style={{ height: 38, padding: "0 16px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.muted, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPrintConfig(false);
                  setTimeout(() => window.print(), 150);
                }}
                style={{ height: 38, padding: "0 22px", border: "none", borderRadius: 8, background: C.gold, color: "#fff", fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}
              >
                Print Report Document
              </button>
            </div>
          </section>
        </div>
      )}

      {/* CSV/Excel Export Customizer Panel with Live Preview (RPT-005) */}
      {showCsvConfig && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(24,20,14,0.42)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 20 }} className="print-exclude">
          <section style={{ width: "min(1200px, 95vw)", height: "calc(100vh - 40px)", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 26px 70px rgba(24,20,14,0.24)", display: "flex", flexDirection: "column", overflow: "hidden", fontFamily: F.body }}>

            {/* Header */}
            <div style={{ padding: "18px 24px", borderBottom: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold }}>Interactive Excel & CSV Export Suite</div>
                <div style={{ marginTop: 4, fontSize: 12.5, color: C.muted }}>Configure spreadsheet structure, delimiters, and target sections with real-time importable preview.</div>
              </div>
              <button
                type="button"
                onClick={() => setShowCsvConfig(false)}
                style={{ border: "none", background: "transparent", color: C.muted, fontSize: 20, cursor: "pointer", fontWeight: 300, padding: 8 }}
              >
                ✕
              </button>
            </div>

            {/* Split Content Area */}
            <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

              {/* Left Config Column */}
              <div style={{ width: 380, borderRight: `1px solid ${C.divider}`, padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, minWidth: 380 }}>

                {/* Filename Customizer */}
                <div style={{ display: "grid", gap: 6 }}>
                  <div style={{ fontFamily: F.label, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: C.faint }}>Target File Name</div>
                  <input
                    type="text"
                    value={csvFilename}
                    onChange={(e) => setCsvFilename(e.target.value)}
                    style={{
                      height: 36,
                      border: `1px solid ${C.border}`,
                      borderRadius: 8,
                      padding: "0 12px",
                      fontSize: 12,
                      fontFamily: F.body,
                      color: C.text,
                      background: C.surfaceInput,
                      outline: "none",
                      width: "100%",
                      boxSizing: "border-box"
                    }}
                    placeholder="Enter file name"
                  />
                  <div style={{ fontSize: 10.5, color: C.muted }}>Pre-filled with date range parameter for Bellevue audits.</div>
                </div>

                <div style={{ height: 1, background: C.divider }} />

                {/* Export Style */}
                <div style={{ display: "grid", gap: 14 }}>
                  <FilterField label="Export Data Structure Style">
                    <select value={csvExportType} onChange={(e) => setCsvExportType(e.target.value)} style={{ ...filterStyle(), width: "100%" }}>
                      <option value="unified">Unified Executive View (Combined reports)</option>
                      <option value="raw">Raw BI Spreadsheet Flat-Grid (Pivot ready)</option>
                    </select>
                  </FilterField>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: -4, lineHeight: 1.4 }}>
                    {csvExportType === "unified"
                      ? "Consolidates overview stats, status, trends, and outlet lists into a clean, human-readable document view."
                      : "Exports a perfect single flat table of all matching reservation records, ideal for Excel Pivot Tables, Google Sheets, or PowerBI imports."}
                  </div>
                </div>

                <div style={{ height: 1, background: C.divider }} />

                {/* Delimiter Selector */}
                <div style={{ display: "grid", gap: 14 }}>
                  <FilterField label="Excel Delimiter Character">
                    <select value={csvDelimiter} onChange={(e) => setCsvDelimiter(e.target.value)} style={{ ...filterStyle(), width: "100%" }}>
                      <option value=",">Comma ( , ) – Standard US format</option>
                      <option value=";">Semicolon ( ; ) – European Excel standard</option>
                    </select>
                  </FilterField>
                </div>

                <div style={{ height: 1, background: C.divider }} />

                {/* Include Metadata Headers */}
                <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.text, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={csvIncludeHeaders}
                    onChange={(e) => setCsvIncludeHeaders(e.target.checked)}
                    style={{ width: 17, height: 17, accentColor: C.gold }}
                  />
                  <span style={{ fontWeight: 550 }}>Include Document Headers & Titles</span>
                </label>

                {csvExportType === "unified" && (
                  <>
                    <div style={{ height: 1, background: C.divider }} />

                    {/* Section Selector */}
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ fontFamily: F.label, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", color: C.faint }}>Sections to Compile</div>
                      <div style={{ display: "grid", gap: 8 }}>
                        {Object.keys(csvSections).map((sec) => (
                          <label key={sec} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: C.text, cursor: "pointer", padding: "2px 0" }}>
                            <input
                              type="checkbox"
                              checked={csvSections[sec]}
                              onChange={(e) => setCsvSections((prev) => ({ ...prev, [sec]: e.target.checked }))}
                              style={{ width: 17, height: 17, accentColor: C.gold }}
                            />
                            <span style={{ textTransform: "capitalize", fontWeight: 550 }}>
                              {sec === "summary" ? "Overview summary details"
                                : sec === "status" ? "Status breakdown mix"
                                  : sec === "trends" ? "Annual & monthly trends"
                                    : sec}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

              </div>

              {/* Right Live Preview Column */}
              <div style={{ flex: 1, background: "#FAF8F4", borderLeft: `1px solid ${C.border}`, padding: "24px 20px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>

                {/* Header Stats */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
                  <div style={{ fontFamily: F.label, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold }}>Spreadsheet Preview Grid</div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <span style={{ background: C.goldFaint, color: C.gold, padding: "3px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700 }}>
                      Estimated Columns: {csvExportType === "raw" ? 16 : "Dynamic"}
                    </span>
                    <span style={{ background: "rgba(46,122,90,0.08)", color: C.green, padding: "3px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700 }}>
                      Estimated Rows: {compileCsvData().length}
                    </span>
                  </div>
                </div>

                {/* Paper sheet spreadsheet preview container */}
                <div
                  style={{
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    borderRadius: 12,
                    boxShadow: "0 8px 30px rgba(24,20,14,0.04)",
                    padding: 20,
                    width: "100%",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                    boxSizing: "border-box",
                    flexShrink: 0,
                    overflowX: "auto"
                  }}
                >
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, minWidth: 600 }}>
                    <thead>
                      <tr style={{ background: C.soft, color: C.faint, borderBottom: `2px solid ${C.gold}` }}>
                        {csvExportType === "raw" ? (
                          <>
                            <th style={{ padding: "8px 6px", textAlign: "left", fontSize: 9, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>Ref Code</th>
                            <th style={{ padding: "8px 6px", textAlign: "left", fontSize: 9, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>Guest Name</th>
                            <th style={{ padding: "8px 6px", textAlign: "left", fontSize: 9, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>Email</th>
                            <th style={{ padding: "8px 6px", textAlign: "left", fontSize: 9, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>Outlet (Parent)</th>
                            <th style={{ padding: "8px 6px", textAlign: "left", fontSize: 9, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>Subroom (Child)</th>
                          </>
                        ) : (
                          <>
                            <th style={{ padding: "8px 6px", textAlign: "left", fontSize: 9, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase", width: "40%" }}>Section / Label</th>
                            <th style={{ padding: "8px 6px", textAlign: "left", fontSize: 9, fontWeight: 800, letterSpacing: "0.04em", textTransform: "uppercase" }}>Spreadsheet Output Values Preview</th>
                          </>
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {csvExportType === "raw" ? (
                        <>
                          <tr style={{ borderBottom: `1px solid ${C.divider}` }}>
                            <td style={{ padding: "8px 6px", fontWeight: 700, color: C.text }}>Bellevue-5812</td>
                            <td style={{ padding: "8px 6px" }}>Christian Dela Cruz</td>
                            <td style={{ padding: "8px 6px" }}>christian@example.com</td>
                            <td style={{ padding: "8px 6px" }}>20/20 Function Room</td>
                            <td style={{ padding: "8px 6px", color: C.green, fontWeight: 650 }}>20/20 Function Room A</td>
                          </tr>
                          <tr style={{ borderBottom: `1px solid ${C.divider}` }}>
                            <td style={{ padding: "8px 6px", fontWeight: 700, color: C.text }}>Bellevue-3421</td>
                            <td style={{ padding: "8px 6px" }}>John Doe</td>
                            <td style={{ padding: "8px 6px" }}>john.doe@example.com</td>
                            <td style={{ padding: "8px 6px" }}>Grand Ballroom</td>
                            <td style={{ padding: "8px 6px", color: C.green, fontWeight: 650 }}>Grand Ballroom B</td>
                          </tr>
                          <tr style={{ borderBottom: `1px solid ${C.divider}` }}>
                            <td style={{ padding: "8px 6px", fontWeight: 700, color: C.text }}>Bellevue-9856</td>
                            <td style={{ padding: "8px 6px" }}>Jane Smith</td>
                            <td style={{ padding: "8px 6px" }}>jane.smith@example.com</td>
                            <td style={{ padding: "8px 6px" }}>Laguna Ballroom</td>
                            <td style={{ padding: "8px 6px", color: C.green, fontWeight: 650 }}>Laguna Ballroom 2</td>
                          </tr>
                        </>
                      ) : (
                        <>
                          {csvIncludeHeaders && (
                            <tr style={{ borderBottom: `1px solid ${C.divider}`, background: C.soft }}>
                              <td style={{ padding: "8px 6px", fontWeight: 700, color: C.gold }}>[HEADER]</td>
                              <td style={{ padding: "8px 6px", fontStyle: "italic", color: C.muted }}>BELLEVUE OUTLET & ROOM PERFORMANCE REPORT · Date: {dateRangeLabel}</td>
                            </tr>
                          )}
                          {csvSections.summary && (
                            <tr style={{ borderBottom: `1px solid ${C.divider}` }}>
                              <td style={{ padding: "8px 6px", fontWeight: 700 }}>OVERVIEW SUMMARY</td>
                              <td style={{ padding: "8px 6px" }}>Reservations Total: {summary.reservations || 0} · Guests Total: {summary.guests || 0}</td>
                            </tr>
                          )}
                          {csvSections.status && (
                            <tr style={{ borderBottom: `1px solid ${C.divider}` }}>
                              <td style={{ padding: "8px 6px", fontWeight: 700 }}>STATUS BREAKDOWN</td>
                              <td style={{ padding: "8px 6px" }}>Approved: {reservedCount} · Pending: {statuses.pending || 0} · Rejected: {statuses.rejected || 0}</td>
                            </tr>
                          )}
                        </>
                      )}
                      <tr>
                        <td colSpan={csvExportType === "raw" ? 5 : 2} style={{ padding: "10px 6px", textTransform: "uppercase", fontSize: 9, color: C.faint, fontWeight: 800, textAlign: "center" }}>
                          + {Math.max(0, compileCsvData().length - 3)} additional rows will export into spreadsheet document
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Raw CSV Text Preview */}
                <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 180 }}>
                  <div style={{ fontFamily: F.label, fontSize: 9.5, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: C.gold, marginBottom: 8 }}>Raw CSV File Stream Output (First 8 lines)</div>
                  <pre
                    style={{
                      flex: 1,
                      margin: 0,
                      background: "#18140E",
                      color: "#FAF8F4",
                      fontFamily: "monospace",
                      fontSize: 11,
                      padding: 14,
                      borderRadius: 10,
                      overflow: "auto",
                      border: "1px solid rgba(255,255,255,0.06)",
                      lineHeight: 1.5,
                      boxSizing: "border-box"
                    }}
                  >
                    {compileCsvData().slice(0, 8).map(row => row.map(csvCell).join(csvDelimiter)).join("\n")}
                  </pre>
                </div>

              </div>

            </div>

            {/* Bottom Actions Bar */}
            <div style={{ padding: "16px 24px", borderTop: `1px solid ${C.divider}`, background: C.soft, display: "flex", justifyContent: "flex-end", gap: 12, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setShowCsvConfig(false)}
                style={{ height: 38, padding: "0 16px", border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.muted, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", cursor: "pointer" }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExportCsv}
                style={{ height: 38, padding: "0 22px", border: "none", borderRadius: 8, background: C.gold, color: "#fff", fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", cursor: "pointer" }}
              >
                Export Spreadsheet File
              </button>
            </div>

          </section>
        </div>
      )}

      {/* 2. Outlet Detailed Modal Report */}
      {activeOutletDetails && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(24,20,14,0.42)", backdropFilter: "blur(4px)", display: "grid", placeItems: "center", padding: 20 }} className="print-exclude">
          <section style={{ width: "min(1060px, 100%)", borderRadius: 16, background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 26px 70px rgba(24,20,14,0.24)", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - 40px)", overflow: "hidden", fontFamily: F.body }}>
            {/* Header */}
            <div style={{ padding: "20px 24px", borderBottom: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold }}>Outlet Performance Report</div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 700, color: C.text }}>{activeOutletDetails}</div>
                <div style={{ marginTop: 2, fontSize: 12.5, color: C.muted }}>
                  Wing: {activeOutletRow?.wing || "No Wing"} · Type: {activeOutletRow?.type || "Outlet"} · Range: {dateRangeLabel}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveOutletDetails(null)}
                style={{ border: "none", background: "transparent", color: C.muted, fontSize: 20, cursor: "pointer", fontWeight: 300, padding: 8 }}
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div style={{ padding: 24, overflowY: "auto", display: "grid", gap: 20 }}>
              {/* KPI Mini Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12 }}>
                <MetricCard label="Total Bookings" value={activeOutletRow?.total_reservations || activeOutletRow?.reservations || outletTransactions.length} tone="blue" />
                <MetricCard label="Approval Rate" value={`${activeOutletRow?.acceptance_rate || 0}%`} detail={`${activeOutletRow?.reserved || 0} reserved`} tone="green" />
                <MetricCard label="Total Guests" value={activeOutletRow?.guests || 0} tone="gold" />
                <MetricCard label="Promo mentions" value={activeOutletRow?.promotion_mentions || 0} tone="slate" />
              </div>

              {/* Charts Section */}
              <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1.2fr) minmax(280px, 0.8fr)", gap: 14 }}>
                {/* Daily Transaction Rhythm */}
                <SummaryPanel title="Daily Transaction Rhythm">
                  {outletChartData.length === 0 ? (
                    <div style={{ display: "grid", placeItems: "center", height: 260, color: C.muted, fontSize: 12.5 }}>
                      No active audit records found for this outlet in the selected date range.
                    </div>
                  ) : (
                    <div style={{ width: "100%", minHeight: 260, borderRadius: 14, background: "linear-gradient(135deg,#FFFFFF 0%,#FAF8F4 58%,#F1ECE1 100%)", border: `1px solid ${C.divider}`, padding: "16px 12px 8px" }}>
                      <ResponsiveContainer width="100%" height={235}>
                        <ComposedChart data={outletChartData} margin={{ top: 12, right: 26, bottom: 8, left: -8 }}>
                          <defs>
                            <linearGradient id="modalOutletReservationFill" x1="0" x2="0" y1="0" y2="1">
                              <stop offset="0%" stopColor={C.blue} stopOpacity="0.22" />
                              <stop offset="54%" stopColor={C.blue} stopOpacity="0.08" />
                              <stop offset="100%" stopColor={C.blue} stopOpacity="0.01" />
                            </linearGradient>
                            <filter id="modalOutletLineShadow" x="-20%" y="-20%" width="140%" height="140%">
                              <feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#3B6FA8" floodOpacity="0.16" />
                            </filter>
                          </defs>
                          <CartesianGrid stroke="rgba(24,20,14,0.07)" vertical={false} />
                          <XAxis
                            dataKey="label"
                            tick={{ fill: C.muted, fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                          />
                          <YAxis
                            allowDecimals={false}
                            tick={{ fill: C.faint, fontSize: 10 }}
                            axisLine={false}
                            tickLine={false}
                            width={30}
                          />
                          <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(140,107,42,0.22)", strokeDasharray: "4 4" }} wrapperStyle={{ outline: "none" }} />
                          <Legend
                            verticalAlign="top"
                            align="right"
                            iconType="plainline"
                            wrapperStyle={{ fontSize: 10, color: C.muted, paddingBottom: 8 }}
                            payload={[
                              { value: "Audit transactions", type: "plainline", color: C.blue },
                              { value: "Approvals", type: "plainline", color: C.green },
                            ]}
                          />
                          <Area
                            type="monotone"
                            dataKey="reservations"
                            fill="url(#modalOutletReservationFill)"
                            stroke="Monotone"
                            dot={false}
                            activeDot={false}
                          />
                          <Line
                            type="monotone"
                            dataKey="reservations"
                            name="Audit transactions"
                            stroke={C.blue}
                            strokeWidth={3}
                            dot={false}
                            activeDot={{ r: 5, strokeWidth: 2, stroke: C.surface, fill: C.blue }}
                            filter="url(#modalOutletLineShadow)"
                          />
                          <Line
                            type="monotone"
                            dataKey="approvals"
                            name="Approvals"
                            stroke={C.green}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, strokeWidth: 2, stroke: C.surface, fill: C.green }}
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </SummaryPanel>

                {/* Donut Chart breakdown */}
                <SummaryPanel title="Status Distribution">
                  <DonutChart
                    counts={{
                      reserved: activeOutletRow?.reserved || 0,
                      pending: activeOutletRow?.pending || 0,
                      declined: activeOutletRow?.rejected || 0,
                      cancelled: activeOutletRow?.cancelled || 0,
                    }}
                    total={activeOutletRow?.total_reservations || activeOutletRow?.reservations || 0}
                  />
                </SummaryPanel>
              </div>

              {/* Audit Transaction Rows */}
              <SummaryPanel title="Outlet Audit Logs">
                <div style={{ border: `1px solid ${C.divider}`, borderRadius: 12, overflow: "hidden", background: C.surface }}>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
                      <thead>
                        <tr style={{ background: C.soft, color: C.faint, textTransform: "uppercase", letterSpacing: "0.10em", fontSize: 10 }}>
                          {["Time", "Reference", "Guest", "Action", "Status change", "Notes"].map((header) => (
                            <th key={header} style={tableHeadStyle()}>{header}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {outletTransactions.length === 0 ? (
                          <tr>
                            <td colSpan={6} style={{ padding: "16px 12px", color: C.muted }}>No recent audit records found for this outlet.</td>
                          </tr>
                        ) : (
                          outletTransactions.slice(0, 10).map((row) => (
                            <tr key={row.id} className="reports-table-row">
                              <td style={cellStyle()}>{readableDateTime(row.created_at)}</td>
                              <td style={cellStyle(true)}>{row.reservation?.reference_code || "-"}</td>
                              <td style={cellStyle()}>{row.reservation?.name || "-"}</td>
                              <td style={cellStyle()}>{actionLabel(row.action)}</td>
                              <td style={cellStyle()}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
                                  {row.from_status && row.to_status && row.from_status !== row.to_status ? (
                                    <>
                                      <StatusPill value={row.from_status} />
                                      <span style={{ color: C.faint }}>to</span>
                                      <StatusPill value={row.to_status} />
                                    </>
                                  ) : (
                                    <StatusPill value={row.to_status || row.from_status || row.reservation?.status} />
                                  )}
                                </div>
                              </td>
                              <td style={{ ...cellStyle(), whiteSpace: "normal", minWidth: 200 }}>{row.notes || "-"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </SummaryPanel>
            </div>

            {/* Footer */}
            <div style={{ padding: "14px 24px", borderTop: `1px solid ${C.divider}`, background: C.soft, display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setActiveOutletDetails(null)}
                style={{ height: 38, padding: "0 22px", border: "none", borderRadius: 8, background: C.gold, color: "#fff", fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.10em", textTransform: "uppercase", cursor: "pointer" }}
              >
                Close Report
              </button>
            </div>
          </section>
        </div>
      )}

      {/* 3. High-fidelity print-only view */}
      <div className="print-only">
        {/* Printable Paper Header */}
        <div className="print-header">
          <div>
            <div className="print-title">THE BELLEVUE MANILA</div>
            <div style={{ fontSize: "10pt", color: C.muted, marginTop: 4 }}>
              Executive Performance & Operational Report · Scoped by {currentUser?.name || currentUser?.email || "Administrator"}{selectedOutlet !== "ALL" && ` · Filtered by: ${selectedOutlet}`}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "10pt", fontWeight: 700, color: C.gold }}>{dateRangeLabel}</div>
            <div style={{ fontSize: "8pt", color: C.muted, marginTop: 2 }}>Printed on {new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</div>
          </div>
        </div>

        {/* Section 1: Overview Summary */}
        {printSections.overview && (
          <div className="print-section">
            <div className="print-section-title">I. Executive Summary</div>
            <div className="print-grid">
              <div className="print-card">
                <div className="print-card-label">Total Reservations</div>
                <div className="print-card-value">{filteredSummary.reservations || 0}</div>
              </div>
              <div className="print-card">
                <div className="print-card-label">Total Guests</div>
                <div className="print-card-value">{filteredSummary.guests || 0}</div>
              </div>
              <div className="print-card">
                <div className="print-card-label">Active Outlets</div>
                <div className="print-card-value">{selectedOutlet === "ALL" ? (summary.outlets || 0) : filteredOutlets.length}</div>
              </div>
              <div className="print-card">
                <div className="print-card-label">Audit Logs Tracked</div>
                <div className="print-card-value">{transactionSummary.transactions || 0}</div>
              </div>
            </div>
          </div>
        )}

        {/* Section 2: Status & Distribution Mix */}
        {printSections.mix && (
          <div className="print-section">
            <div className="print-section-title">II. Distribution & Booking Status Mix</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <div>
                <div style={{ fontSize: "9pt", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Reservation Status Allocation</div>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Status Name</th>
                      <th>Bookings count</th>
                      <th>Percentage</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="strong">Reserved / Approved</td>
                      <td>{filteredSummary.reserved}</td>
                      <td>{filteredSummary.reservations ? Math.round((filteredSummary.reserved / filteredSummary.reservations) * 100) : 0}%</td>
                    </tr>
                    <tr>
                      <td className="strong">Pending Coordination</td>
                      <td>{filteredSummary.pending}</td>
                      <td>{filteredSummary.reservations ? Math.round((filteredSummary.pending / filteredSummary.reservations) * 100) : 0}%</td>
                    </tr>
                    <tr>
                      <td className="strong">Rejected / Declined</td>
                      <td>{filteredSummary.rejected}</td>
                      <td>{filteredSummary.reservations ? Math.round((filteredSummary.rejected / filteredSummary.reservations) * 100) : 0}%</td>
                    </tr>
                    <tr>
                      <td className="strong">Cancelled By User</td>
                      <td>{filteredSummary.cancelled}</td>
                      <td>{filteredSummary.reservations ? Math.round((filteredSummary.cancelled / filteredSummary.reservations) * 100) : 0}%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div>
                <div style={{ fontSize: "9pt", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Reservation Category Mix</div>
                <table className="print-table">
                  <thead>
                    <tr>
                      <th>Category Type</th>
                      <th>Bookings count</th>
                      <th>Guests count</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="strong">Dine-In Outlets</td>
                      <td>{filteredCategory.dine_in?.reservations || 0}</td>
                      <td>{filteredCategory.dine_in?.guests || 0} guests</td>
                    </tr>
                    <tr>
                      <td className="strong">Room Service / Tables</td>
                      <td>{filteredCategory.room_reservations?.reservations || 0}</td>
                      <td>{filteredCategory.room_reservations?.guests || 0} guests</td>
                    </tr>
                    <tr>
                      <td className="strong">Promotions Mentioned</td>
                      <td>{filteredCategory.promotion_mentions?.reservations || 0}</td>
                      <td>-</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Section 3: Outlet Performance */}
        {printSections.outlets && (
          <div className="print-section">
            <div className="print-section-title">III. Detailed Venue Performance Listing</div>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Outlet / Venue Name</th>
                  <th>Wing Location</th>
                  <th>Type</th>
                  <th>Bookings</th>
                  <th>Guests</th>
                  <th>Approved</th>
                  <th>Pending</th>
                  <th>Rejected</th>
                  <th>Cancelled</th>
                  <th>Dine-In</th>
                  <th>Promo Mentions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOutlets.map((outlet) => (
                  <tr key={outlet.name || outlet.venue_id}>
                    <td className="strong">{outlet.name}</td>
                    <td>{outlet.wing || "Main Wing"}</td>
                    <td>{outlet.type || "Outlet"}</td>
                    <td className="strong">{outlet.total_reservations || 0}</td>
                    <td>{outlet.guests || 0}</td>
                    <td>{outlet.reserved || 0} ({outlet.acceptance_rate}%)</td>
                    <td>{outlet.pending || 0}</td>
                    <td>{outlet.rejected || 0}</td>
                    <td>{outlet.cancelled || 0}</td>
                    <td>{outlet.dine_in || 0}</td>
                    <td>{outlet.promotion_mentions || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Section 4: Room Totals */}
        {printSections.rooms && (
          <div className="print-section">
            <div className="print-section-title">IV. Room Totals & Location Performance</div>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Room / Outlet Name</th>
                  <th>Total Reservations</th>
                  <th>Total Guests</th>
                  <th>Pending</th>
                  <th>Reserved / Approved</th>
                  <th>Rejected / Declined</th>
                  <th>Cancelled</th>
                  <th>Dine-In</th>
                  <th>Promo Mentions</th>
                  <th>Latest Active Event</th>
                </tr>
              </thead>
              <tbody>
                {roomDetails.map((room) => (
                  <tr key={room.room}>
                    <td className="strong">{room.room}</td>
                    <td className="strong">{room.reservations || 0}</td>
                    <td>{room.guests || 0}</td>
                    <td>{room.pending || 0}</td>
                    <td>{room.reserved || 0}</td>
                    <td>{room.rejected || 0}</td>
                    <td>{room.cancelled || 0}</td>
                    <td>{room.dine_in || 0}</td>
                    <td>{room.promotion_mentions || 0}</td>
                    <td>{room.latest_event_date || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Section 5: Seasonality Trends */}
        {printSections.trends && (
          <div className="print-section">
            <div className="print-section-title">V. Seasonality Trends & Activity Ledger</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              {monthlyReport.months && monthlyReport.months.length > 0 && (
                <div>
                  <div style={{ fontSize: "9pt", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Annual Month-by-Month Trend</div>
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>Month Period</th>
                        <th>Reservations count</th>
                        <th>Promo Mentions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyReport.months.map((m) => (
                        <tr key={m.label || m.month}>
                          <td className="strong">{m.label || m.month}</td>
                          <td>{m.reservations || 0}</td>
                          <td>{m.promotion_mentions || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {((monthlyGranularity === "weekly" ? monthlyReport.selected_month?.weeks : monthlyReport.selected_month?.days) || []).length > 0 && (
                <div>
                  <div style={{ fontSize: "9pt", fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    {selectedMonthLabel} {monthlyGranularity === "weekly" ? "Weekly" : "Daily"} Density
                  </div>
                  <table className="print-table">
                    <thead>
                      <tr>
                        <th>Date / Period</th>
                        <th>Reservations count</th>
                        <th>Promo Mentions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {((monthlyGranularity === "weekly" ? monthlyReport.selected_month?.weeks : monthlyReport.selected_month?.days) || []).slice(0, 15).map((row) => (
                        <tr key={row.label}>
                          <td className="strong">{row.label}</td>
                          <td>{row.reservations || 0}</td>
                          <td>{row.promotion_mentions || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {((monthlyGranularity === "weekly" ? monthlyReport.selected_month?.weeks : monthlyReport.selected_month?.days) || []).length > 15 && (
                    <div style={{ fontSize: "8pt", color: C.muted, marginTop: 6, textAlign: "right" }}>* Density ledger continues for all days in selected month...</div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Section 6: Audit Logs */}
        {printSections.audit && canViewTransactions && (
          <div className="print-section">
            <div className="print-section-title">VI. Audit Trail Transaction Ledger</div>
            <table className="print-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Reference Code</th>
                  <th>Guest Name</th>
                  <th>Venue / Location</th>
                  <th>Change Description</th>
                  <th>Action taken</th>
                  <th>Performed By</th>
                  <th>Coordinator notes</th>
                </tr>
              </thead>
              <tbody>
                {(transactionReport.data || []).map((row) => {
                  const reservation = row.reservation || {};
                  const venue = row.venue || {};
                  return (
                    <tr key={row.id}>
                      <td>{readableDateTime(row.created_at)}</td>
                      <td className="strong">{reservation.reference_code || "-"}</td>
                      <td>{reservation.name || "-"}</td>
                      <td>{venue.name || reservation.room || "-"}</td>
                      <td>
                        {row.from_status && row.to_status && row.from_status !== row.to_status
                          ? `${row.from_status.toUpperCase()} ➔ ${row.to_status.toUpperCase()}`
                          : (row.to_status || row.from_status || reservation.status || "-").toUpperCase()
                        }
                      </td>
                      <td>{actionLabel(row.action)}</td>
                      <td>{getPerformedBy(row)}</td>
                      <td style={{ fontSize: "8.5pt" }}>{row.notes || "-"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Print Footer */}
        <div style={{ borderTop: "1px solid #8C6B2A", marginTop: 40, paddingTop: 10, display: "flex", justifyContent: "space-between", fontSize: "8pt", color: C.muted }}>
          <span>The Bellevue Manila · Confidential Management Report</span>
          <span>End of Document</span>
        </div>
      </div>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 3 }}>
      <span style={{ fontFamily: F.label, fontSize: 8.5, fontWeight: 750, letterSpacing: "0.12em", textTransform: "uppercase", color: C.muted }}>{label}</span>
      {children}
    </label>
  );
}

function filterStyle() {
  return {
    height: 34,
    border: `1px solid rgba(0,0,0,0.08)`,
    borderRadius: 8,
    background: C.surface,
    color: C.text,
    padding: "0 10px",
    fontFamily: F.body,
    fontSize: 12,
    outline: "none",
    transition: "border-color 0.12s",
  };
}

function pagerButtonStyle() {
  return {
    height: 30,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    background: C.surface,
    color: C.gold,
    padding: "0 11px",
    fontFamily: F.label,
    fontSize: 10,
    fontWeight: 750,
    letterSpacing: "0.10em",
    textTransform: "uppercase",
  };
}

function tableHeadStyle() {
  return {
    textAlign: "left",
    padding: "12px 16px",
    borderBottom: `1px solid rgba(140,107,42,0.15)`,
    color: C.muted,
    fontFamily: F.label,
    fontSize: 9.5,
    fontWeight: 750,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    background: "#FAF8F4",
  };
}

function cellStyle(strong = false) {
  return {
    padding: "14px 16px",
    borderBottom: `1px solid rgba(0,0,0,0.04)`,
    color: strong ? C.text : C.muted,
    fontWeight: strong ? 650 : 550,
    fontSize: 12.5,
    whiteSpace: "nowrap",
    transition: "background 0.12s",
  };
}
