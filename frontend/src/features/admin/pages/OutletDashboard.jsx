import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Activity,
  AlertCircle,
  CalendarDays,
  CheckCircle,
  ChevronDown,
  Clock,
  Layers,
  Search,
  TrendingUp,
  Users,
} from "lucide-react";
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
import AdminNavbar from "../../../components/layout/AdminNavbar";
import Sidebar from "../../../components/layout/Sidebar";
import { authAPI } from "../../../services/authAPI";
import { reportAPI } from "../../../services/reportAPI";
import { fetchReservations } from "../../../utils/api";
import { canonicalOutletName, outletGroupLabel } from "../../../constants/outletCatalog";

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

const POLL_INTERVAL_MS = 5000;
const RECONNECT_WINDOW_MS = 60000;
const MAX_RECONNECTS_IN_WINDOW = 5;
const WS_RECOVERY_RETRY_MS = 45000;

const OUTLET_TREE = [
  {
    id: "main-wing",
    label: "Main Wing",
    sections: [
      { label: "Alabang Function Room", items: ["Alabang Function Room"] },
      { label: "Business Center", items: ["Business Center"] },
      { label: "Laguna Ballroom", items: ["Laguna Ballroom 1", "Laguna Ballroom 2"] },
      { label: "20/20 Function Room", items: ["20/20 Function Room A", "20/20 Function Room B", "20/20 Function Room C"] },
    ],
  },
  {
    id: "tower-wing",
    label: "Tower Wing",
    sections: [
      { label: "Grand Ballroom", items: ["Grand Ballroom A", "Grand Ballroom B", "Grand Ballroom C"] },
      { label: "Tower Ballroom", items: ["Tower 1", "Tower 2", "Tower 3"] },
    ],
  },
  {
    id: "dining",
    label: "Dining",
    sections: [
      { label: "Hanakazu Japanese Restaurant", items: ["Hanakazu Japanese Restaurant"] },
      { label: "Qsina Restaurant", items: ["Qsina Restaurant"] },
      { label: "Phoenix Court", items: ["Phoenix Court"] },
    ],
  },
];

function today() {
  const date = new Date();
  return date.toISOString().slice(0, 10);
}

function weekFromToday() {
  const date = new Date();
  date.setDate(date.getDate() + 7);
  return date.toISOString().slice(0, 10);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function readableDate(value) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function readableTime(value) {
  if (!value) return "-";
  const raw = String(value);
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  const hour = Number(match[1]);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${((hour + 11) % 12) + 1}:${match[2]} ${suffix}`;
}

function readableMonth(monthIndex) {
  return new Date(2026, monthIndex, 1).toLocaleDateString("en-US", { month: "short" });
}

function periodLabel(row, period) {
  return period === "yearly" ? row.label : readableDate(row.date);
}

function availabilityMap(outlets) {
  return new Map(outlets.map((outlet) => [String(outlet.name), outlet]));
}

function buildSelectableOutlets(outlets) {
  const byName = availabilityMap(outlets);
  const rows = [];
  const pushed = new Set();

  OUTLET_TREE.forEach((group) => {
    group.sections.forEach((section) => {
      const children = section.items.filter((name) => byName.has(name));
      const parent = byName.get(section.label);
      const isAggregateParent = section.items.length > 1 && children.length > 0;

      if (isAggregateParent) {
        rows.push({
          ...(parent || {}),
          name: section.label,
          wing: group.label,
          type: "group",
          aggregate: true,
          children,
        });
        pushed.add(section.label);
      } else if (parent) {
        rows.push(parent);
        pushed.add(section.label);
      }

      children.forEach((name) => {
        if (!pushed.has(name)) {
          rows.push(byName.get(name));
          pushed.add(name);
        }
      });
    });
  });

  outlets.forEach((outlet) => {
    if (!pushed.has(outlet.name)) rows.push(outlet);
  });

  return rows;
}

function normalizeStatus(value) {
  const status = String(value || "pending").toLowerCase();
  if (["approved", "reserved", "confirmed", "accepted"].includes(status)) return "reserved";
  if (["rejected", "declined"].includes(status)) return "declined";
  if (["cancelled", "canceled"].includes(status)) return "cancelled";
  return "pending";
}

function outletNameForReservation(reservation) {
  return canonicalOutletName(reservation?.room || reservation?.venue?.name || reservation?.venue || "Unassigned Outlet");
}

function eventTypeFor(reservation, outletName) {
  const outlet = String(outletName || "").toLowerCase();
  const type = String(reservation?.type || "").toLowerCase();
  if (outlet.includes("restaurant") || outlet.includes("phoenix") || outlet.includes("qsina") || outlet.includes("hanakazu")) return "Dine-in";
  if (type.includes("standalone") || String(reservation?.table_number || "").toLowerCase() === "standalone") return "Standalone";
  if (type.includes("individual")) return "Individual Seat";
  return "Room/Table";
}

function isWithinRange(value, startDate, endDate) {
  if (!value) return true;
  if (startDate && value < startDate) return false;
  if (endDate && value > endDate) return false;
  return true;
}

function compareEventDate(a, b) {
  const av = `${a.event_date || ""} ${a.event_time || ""}`;
  const bv = `${b.event_date || ""} ${b.event_time || ""}`;
  return av.localeCompare(bv);
}

function parseDateTime(value) {
  if (!value) return null;
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? null : date;
}

function reservationSubmittedAt(reservation) {
  return parseDateTime(reservation?.submitted_at || reservation?.created_at || reservation?.status_last_changed_at);
}

function pendingAgeMinutes(reservation) {
  const submittedAt = reservationSubmittedAt(reservation);
  if (!submittedAt) return 0;
  return Math.max(0, Math.floor((Date.now() - submittedAt.getTime()) / 60000));
}

function formatAge(minutes) {
  if (!minutes) return "Just now";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours < 24) return remaining ? `${hours}h ${remaining}m` : `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d ${hours % 24}h`;
}

function responsePriority(reservation) {
  const minutes = pendingAgeMinutes(reservation);
  if (minutes >= 120) return { label: "Overdue", color: C.red, bg: C.redFaint, minutes };
  if (minutes >= 45) return { label: "Review soon", color: C.gold, bg: C.goldFaint, minutes };
  return { label: "On track", color: C.green, bg: C.greenFaint, minutes };
}

function tone(status) {
  return {
    reserved: [C.green, C.greenFaint],
    pending: [C.gold, C.goldFaint],
    declined: [C.red, C.redFaint],
    cancelled: [C.slate, C.slateFaint],
  }[status] || [C.slate, C.slateFaint];
}

function Field({ label, children }) {
  return (
    <div style={{ display: "grid", gap: 5, minWidth: 0 }}>
      <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 750, letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint }}>{label}</span>
      {children}
    </div>
  );
}

function inputStyle(extra = {}) {
  return {
    height: 38,
    border: `1px solid ${C.border}`,
    borderRadius: 9,
    background: C.surface,
    color: C.text,
    padding: "0 10px",
    fontFamily: F.body,
    fontSize: 12,
    outline: "none",
    minWidth: 0,
    ...extra,
  };
}

function OutletSelector({ outlets, selectedOutlet, onSelect }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const available = useMemo(() => availabilityMap(outlets), [outlets]);
  const normalizedQuery = query.trim().toLowerCase();
  const selectedName = selectedOutlet?.name || "Select outlet";
  const fallbackOutlets = outlets.filter((outlet) => !OUTLET_TREE.some((group) =>
    group.sections.some((section) => section.label === outlet.name || section.items.includes(outlet.name))
  ));

  const matches = (name) => !normalizedQuery || name.toLowerCase().includes(normalizedQuery);
  const selectOutlet = (name) => {
    const outlet = available.get(name);
    if (!outlet) return;
    onSelect(outlet);
    setOpen(false);
    setQuery("");
  };

  return (
    <div style={{ position: "relative", minWidth: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        style={{
          ...inputStyle({
            width: "100%",
            display: "grid",
            gridTemplateColumns: "minmax(0,1fr) auto",
            alignItems: "center",
            textAlign: "left",
            cursor: "pointer",
            background: open ? C.goldFaint : C.surface,
          }),
        }}
      >
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>{selectedName}</span>
          <span style={{ display: "block", marginTop: 1, color: C.faint, fontSize: 10.5 }}>
            {selectedOutlet?.aggregate ? `Grouped view - ${selectedOutlet.children.length} outlets` : selectedOutlet ? outletGroupLabel(selectedOutlet.name) : "Operational outlet"}
          </span>
        </span>
        <ChevronDown size={15} color={C.gold} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.18s" }} />
      </button>

      {open && (
        <div style={{ position: "absolute", top: 45, left: 0, right: 0, zIndex: 30, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 18px 44px rgba(40,32,18,0.16)", overflow: "hidden" }}>
          <div style={{ padding: 10, borderBottom: `1px solid ${C.divider}` }}>
            <div style={{ height: 36, border: `1px solid ${C.border}`, borderRadius: 9, background: C.soft, display: "flex", alignItems: "center", gap: 8, padding: "0 10px" }}>
              <Search size={14} color={C.faint} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search outlet or sub-room" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 12, color: C.text }} autoFocus />
            </div>
          </div>
          <div style={{ maxHeight: 360, overflowY: "auto", padding: "8px 8px 10px", display: "grid", gap: 8 }}>
            {OUTLET_TREE.map((group) => {
              const visibleSections = group.sections.map((section) => {
                const parent = available.get(section.label);
                const parentAvailable = Boolean(parent);
                const visibleItems = section.items.filter((name) => available.has(name) && matches(name));
                const showParent = parentAvailable && matches(section.label);
                return { ...section, parent, parentAvailable, visibleItems, showParent };
              }).filter((section) => section.showParent || section.visibleItems.length);
              if (!visibleSections.length) return null;
              return (
                <div key={group.id} style={{ border: `1px solid ${C.divider}`, borderRadius: 10, overflow: "hidden", background: C.soft }}>
                  <div style={{ padding: "8px 10px", fontFamily: F.label, fontSize: 9, fontWeight: 850, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold, background: "rgba(140,107,42,0.045)" }}>{group.label}</div>
                  <div style={{ display: "grid", background: C.surface }}>
                    {visibleSections.map((section) => (
                      <div key={section.label} style={{ borderTop: `1px solid ${C.divider}` }}>
                        {section.showParent && (
                          <OutletOption
                            name={section.label}
                            active={selectedName === section.label}
                            onClick={() => selectOutlet(section.label)}
                            depth={0}
                            badge={section.parent?.aggregate ? "View all" : "Outlet"}
                          />
                        )}
                        {!section.showParent && section.visibleItems.length > 0 && (
                          <div style={{ padding: "8px 10px 4px", fontSize: 11, fontWeight: 750, color: C.text }}>{section.label}</div>
                        )}
                        {section.visibleItems.filter((name) => name !== section.label).map((name) => (
                          <OutletOption key={name} name={name} active={selectedName === name} onClick={() => selectOutlet(name)} depth={section.items.length > 1 || section.label !== name ? 1 : 0} badge="Sub-room" />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            {fallbackOutlets.filter((outlet) => matches(outlet.name)).length > 0 && (
              <div style={{ border: `1px solid ${C.divider}`, borderRadius: 10, overflow: "hidden", background: C.surface }}>
                <div style={{ padding: "8px 10px", fontFamily: F.label, fontSize: 9, fontWeight: 850, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold, background: C.soft }}>Other Outlets</div>
                {fallbackOutlets.filter((outlet) => matches(outlet.name)).map((outlet) => (
                  <OutletOption key={outlet.name} name={outlet.name} active={selectedName === outlet.name} onClick={() => selectOutlet(outlet.name)} depth={0} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OutletOption({ name, active, onClick, depth, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 34,
        border: "none",
        background: active ? C.goldFaint : "transparent",
        color: active ? C.gold : C.text,
        display: "grid",
        gridTemplateColumns: "minmax(0,1fr) auto",
        gap: 8,
        alignItems: "center",
        padding: depth ? "7px 10px 7px 26px" : "8px 10px",
        textAlign: "left",
        cursor: "pointer",
        transition: "background 0.16s, color 0.16s",
      }}
      onMouseEnter={(event) => { if (!active) event.currentTarget.style.background = "rgba(140,107,42,0.045)"; }}
      onMouseLeave={(event) => { if (!active) event.currentTarget.style.background = "transparent"; }}
    >
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: active ? 750 : 500 }}>{name}</span>
      {badge && <span style={{ fontSize: 9, color: active ? C.gold : C.faint, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>{badge}</span>}
    </button>
  );
}

function Panel({ title, subtitle, right, children, style = {} }) {
  return (
    <section style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden", ...style }}>
      {(title || right) && (
        <div style={{ padding: "13px 15px", borderBottom: `1px solid ${C.divider}`, display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
          <div>
            {title && <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold }}>{title}</div>}
            {subtitle && <div style={{ marginTop: 4, fontSize: 12, color: C.muted }}>{subtitle}</div>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

function MetricCard({ icon: Icon, label, value, detail, color = C.gold, bg = C.goldFaint }) {
  return (
    <div className="od-card" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 15, display: "grid", gap: 10, minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
        <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint }}>{label}</span>
        <span style={{ width: 30, height: 30, borderRadius: 9, background: bg, display: "grid", placeItems: "center", color }}>
          <Icon size={15} />
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ color, fontSize: 27, lineHeight: 1, fontWeight: 700 }}>{value}</span>
        {detail && <span style={{ color: C.muted, fontSize: 12 }}>{detail}</span>}
      </div>
    </div>
  );
}

function StatusPill({ status }) {
  const normalized = normalizeStatus(status);
  const [color, bg] = tone(normalized);
  return (
    <span style={{ display: "inline-flex", alignItems: "center", borderRadius: 999, padding: "4px 8px", background: bg, color, fontSize: 9, fontWeight: 800, letterSpacing: "0.09em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {normalized}
    </span>
  );
}

function PeriodSwitch({ value, onChange }) {
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: 3, border: `1px solid ${C.border}`, borderRadius: 999, background: C.soft }}>
      {[
        ["monthly", "Monthly"],
        ["yearly", "Yearly"],
      ].map(([key, label]) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          style={{
            height: 26,
            border: "none",
            borderRadius: 999,
            padding: "0 10px",
            background: value === key ? C.surface : "transparent",
            color: value === key ? C.gold : C.muted,
            boxShadow: value === key ? "0 4px 14px rgba(40,32,18,0.08)" : "none",
            fontFamily: F.label,
            fontSize: 9,
            fontWeight: 850,
            letterSpacing: "0.10em",
            textTransform: "uppercase",
            cursor: "pointer",
            transition: "background 0.18s, color 0.18s, box-shadow 0.18s",
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function OutletChartTooltip({ active, payload, label }) {
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
    <div style={{ background: C.surface, border: "1px solid rgba(140,107,42,0.18)", borderRadius: 10, boxShadow: "0 12px 26px rgba(24,20,14,0.12)", padding: "10px 11px", minWidth: 154 }}>
      <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 850, letterSpacing: "0.10em", textTransform: "uppercase", color: C.gold, marginBottom: 8 }}>{label}</div>
      <div style={{ display: "grid", gap: 6 }}>
        {visiblePayload.map((item) => (
          <div key={item.dataKey} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 14, fontSize: 12, color: C.muted }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: item.color }} />
              {item.name}
            </span>
            <strong style={{ color: C.text, fontWeight: 750 }}>{item.value || 0}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ rows, period = "monthly" }) {
  const data = (rows || []).map((row) => ({
    ...row,
    label: periodLabel(row, period),
    reservations: Number(row.count || 0),
  }));
  const labelInterval = data.length > 16 ? Math.ceil(data.length / 8) - 1 : 0;

  return (
    <div style={{ width: "100%", minHeight: 260, borderRadius: 14, background: "linear-gradient(135deg,#FFFFFF 0%,#FAF8F4 58%,#F1ECE1 100%)", border: `1px solid ${C.divider}`, padding: "16px 12px 8px", boxShadow: "inset 0 1px 0 rgba(255,255,255,0.72)" }}>
      <ResponsiveContainer width="100%" height={235}>
        <ComposedChart data={data} margin={{ top: 12, right: 26, bottom: 8, left: -8 }}>
          <defs>
            <linearGradient id="outletReservationFill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={C.blue} stopOpacity="0.22" />
              <stop offset="54%" stopColor={C.blue} stopOpacity="0.08" />
              <stop offset="100%" stopColor={C.blue} stopOpacity="0.01" />
            </linearGradient>
            <filter id="outletLineShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="7" stdDeviation="7" floodColor="#3B6FA8" floodOpacity="0.16" />
            </filter>
          </defs>
          <CartesianGrid stroke="rgba(24,20,14,0.07)" vertical={false} />
          <XAxis
            dataKey="label"
            interval={labelInterval}
            tick={{ fill: C.muted, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            minTickGap={12}
            padding={{ left: 12, right: 16 }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: C.faint, fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={34}
          />
          <Tooltip content={<OutletChartTooltip />} cursor={{ stroke: "rgba(140,107,42,0.22)", strokeDasharray: "4 4" }} wrapperStyle={{ outline: "none" }} />
          <Legend
            verticalAlign="top"
            align="right"
            iconType="plainline"
            wrapperStyle={{ fontSize: 11, color: C.muted, paddingBottom: 12 }}
            payload={[{ value: "Reservations", type: "plainline", color: C.blue }]}
          />
          <Area
            type="monotone"
            dataKey="reservations"
            legendType="none"
            fill="url(#outletReservationFill)"
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
            strokeWidth={3.2}
            dot={false}
            activeDot={{ r: 5.5, strokeWidth: 3, stroke: C.surface, fill: C.blue }}
            connectNulls
            isAnimationActive
            animationDuration={720}
            filter="url(#outletLineShadow)"
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function DonutChart({ counts, total }) {
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
          const segment = <circle key={label} className="od-donut" cx="21" cy="21" r="15.915" fill="transparent" stroke={color} strokeWidth="5" strokeDasharray={`${dash} ${circumference - dash}`} strokeDashoffset={offset} />;
          offset -= dash;
          return segment;
        })}
        <text x="21" y="22" textAnchor="middle" fontSize="7" fontWeight="700" fill={C.text} transform="rotate(90 21 21)">{total}</text>
      </svg>
      <div style={{ display: "grid", gap: 9 }}>
        {["reserved", "pending", "declined", "cancelled"].map((key) => {
          const [color, bg] = tone(key);
          const value = counts[key] || 0;
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

function BarChart({ rows }) {
  const [hovered, setHovered] = useState(null);
  const max = Math.max(1, ...rows.map((row) => row.value));
  return (
    <div style={{ padding: 16, display: "grid", gap: 12 }}>
      {rows.map((row) => (
        <div key={row.label} onMouseEnter={() => setHovered(row.label)} onMouseLeave={() => setHovered(null)} style={{ display: "grid", gridTemplateColumns: "120px minmax(0,1fr) 34px", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{row.label}</span>
          <div style={{ height: 9, borderRadius: 999, background: "rgba(0,0,0,0.05)", overflow: "hidden" }}>
            <div className="od-bar" title={`${row.label}: ${row.value}`} style={{ height: "100%", width: `${(row.value / max) * 100}%`, borderRadius: 999, background: row.color, boxShadow: hovered === row.label ? `0 0 0 3px ${row.color}22` : "none", filter: hovered === row.label ? "saturate(1.15)" : "none", transition: "box-shadow 0.16s, filter 0.16s" }} />
          </div>
          <strong style={{ fontSize: hovered === row.label ? 13 : 12, color: hovered === row.label ? row.color : C.text, textAlign: "right", transition: "color 0.16s, font-size 0.16s" }}>{row.value}</strong>
        </div>
      ))}
    </div>
  );
}

function PriorityBadge({ reservation }) {
  const priority = responsePriority(reservation);
  return (
    <span style={{ justifySelf: "start", borderRadius: 999, padding: "4px 8px", background: priority.bg, color: priority.color, fontSize: 9, fontWeight: 850, letterSpacing: "0.08em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
      {priority.label} · {formatAge(priority.minutes)}
    </span>
  );
}

function ReservationRow({ reservation, showPriority = false }) {
  const outlet = outletNameForReservation(reservation);
  return (
    <div style={{ padding: "11px 12px", borderBottom: `1px solid ${C.divider}`, display: "grid", gridTemplateColumns: showPriority ? "minmax(180px,1fr) 120px 88px 116px 92px" : "minmax(180px,1fr) 120px 88px 92px", gap: 12, alignItems: "center" }} className="od-row">
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reservation.name || reservation.guest_name || "Guest"}</div>
        <div style={{ marginTop: 3, fontSize: 11.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{reservation.reference_code || reservation.reference || "-"} - {outlet}</div>
        {(reservation.last_handled_by_name || reservation.assigned_handler_name || reservation.last_operational_action) && (
          <div style={{ marginTop: 4, fontSize: 10.5, color: C.faint, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {reservation.last_operational_action || "Coordination"}{reservation.last_handled_by_name || reservation.assigned_handler_name ? ` by ${reservation.last_handled_by_name || reservation.assigned_handler_name}` : ""}
          </div>
        )}
      </div>
      <div style={{ fontSize: 12, color: C.muted }}>{readableDate(reservation.event_date)}<br /><span style={{ color: C.faint }}>{readableTime(reservation.event_time)}</span></div>
      <div style={{ fontSize: 12, color: C.muted }}>{reservation.guests_count || reservation.guests || 0} guests</div>
      {showPriority && <PriorityBadge reservation={reservation} />}
      <StatusPill status={reservation.status} />
    </div>
  );
}

function OutletDashboard() {
  const navigate = useNavigate();
  const params = useParams();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [startDate, setStartDate] = useState(today());
  const [endDate, setEndDate] = useState(weekFromToday());
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("date_asc");
  const [analyticsPeriod, setAnalyticsPeriod] = useState("monthly");
  const [reports, setReports] = useState({ data: [], summary: {} });
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [wsStatus, setWsStatus] = useState("connecting");
  const [error, setError] = useState("");
  const isMounted = useRef(true);
  const wsRef = useRef(null);
  const reconnectTimer = useRef(null);
  const reconnectDelay = useRef(2000);
  const reconnectAttempts = useRef([]);
  const pollTimer = useRef(null);
  const recoveryTimer = useRef(null);

  const canViewReports = authAPI.hasPermission("view_outlet_reports");
  const canManageReservations = authAPI.hasPermission("manage_reservations");
  const currentUser = authAPI.getCurrentUser();

  const loadDashboard = useCallback(async (silent = false) => {
    if (!canViewReports) return;
    if (silent) setSyncing(true);
    else setLoading(true);
    setError("");
    try {
      const [reportData, reservationData] = await Promise.all([
        reportAPI.getOutletReports({ start_date: startDate, end_date: endDate }),
        fetchReservations(1, 9999),
      ]);
      setReports(reportData || { data: [] });
      setReservations(Array.isArray(reservationData?.data) ? reservationData.data : Array.isArray(reservationData) ? reservationData : []);
    } catch (err) {
      setError(err.message || "Failed to load outlet dashboard.");
    } finally {
      if (silent) setSyncing(false);
      else setLoading(false);
    }
  }, [canViewReports, endDate, startDate]);

  useEffect(() => {
    isMounted.current = true;
    loadDashboard(false);
    return () => {
      isMounted.current = false;
    };
  }, [loadDashboard]);

  useEffect(() => {
    if (!canViewReports) return undefined;

    const wsHost = import.meta.env.VITE_WS_HOST || "localhost";
    const wsPort = import.meta.env.VITE_WS_PORT || "6001";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${wsHost}:${wsPort}`;

    const clearReconnect = () => {
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current);
        reconnectTimer.current = null;
      }
    };

    const clearPoll = () => {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      if (recoveryTimer.current) {
        clearInterval(recoveryTimer.current);
        recoveryTimer.current = null;
      }
    };

    const shouldFallbackToPolling = () => {
      const now = Date.now();
      reconnectAttempts.current = [...reconnectAttempts.current.filter((ts) => now - ts <= RECONNECT_WINDOW_MS), now];
      return reconnectAttempts.current.length >= MAX_RECONNECTS_IN_WINDOW;
    };

    const refreshFromEvent = () => {
      if (!isMounted.current) return;
      loadDashboard(true);
    };

    const connect = () => {
      if (!isMounted.current) return;
      clearReconnect();
      if (!wsRef.current) setWsStatus((prev) => (prev === "polling" ? prev : "connecting"));

      const socket = new WebSocket(wsUrl);
      wsRef.current = socket;

      socket.onopen = () => {
        setWsStatus("connected");
        reconnectDelay.current = 2000;
        reconnectAttempts.current = [];
        clearPoll();
      };

      socket.onclose = () => {
        wsRef.current = null;
        if (!isMounted.current) return;
        if (shouldFallbackToPolling()) {
          setWsStatus("polling");
          if (!pollTimer.current) {
            refreshFromEvent();
            pollTimer.current = setInterval(refreshFromEvent, POLL_INTERVAL_MS);
          }
          if (!recoveryTimer.current) {
            recoveryTimer.current = setInterval(() => {
              if (!wsRef.current && isMounted.current) connect();
            }, WS_RECOVERY_RETRY_MS);
          }
          return;
        }
        setWsStatus("disconnected");
        const delay = reconnectDelay.current;
        reconnectTimer.current = setTimeout(connect, delay);
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
      };

      socket.onerror = () => {
        if (!isMounted.current) return;
        setWsStatus((prev) => (prev === "polling" ? "polling" : "error"));
        if (socket.readyState === WebSocket.OPEN) socket.close();
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          const eventName = data?.event;
          if (eventName === "connected") return;
          if (["ReservationCreated", "ReservationUpdated", "ReservationDeleted", "NotificationAcknowledged", "updated"].includes(eventName)) {
            refreshFromEvent();
          }
        } catch (err) {
          console.error("[OutletDashboard WS] Parse error:", err);
        }
      };
    };

    connect();

    return () => {
      clearReconnect();
      clearPoll();
      if (wsRef.current) {
        const socket = wsRef.current;
        wsRef.current = null;
        socket.close();
      }
    };
  }, [canViewReports, loadDashboard]);

  const outlets = useMemo(() => {
    const rows = reports.data || [];
    return [...rows].sort((a, b) => String(a.name).localeCompare(String(b.name)));
  }, [reports.data]);

  const selectableOutlets = useMemo(() => buildSelectableOutlets(outlets), [outlets]);

  const selectedOutlet = useMemo(() => {
    if (!selectableOutlets.length) return null;
    const fromRoute = selectableOutlets.find((outlet) => slugify(outlet.name) === params.outletSlug);
    const defaultOutlet = selectableOutlets.find((outlet) => outlet.name === "Alabang Function Room");
    return fromRoute || defaultOutlet || selectableOutlets[0];
  }, [selectableOutlets, params.outletSlug]);

  useEffect(() => {
    if (!selectedOutlet || params.outletSlug) return;
    navigate(`/admin/outlets/${slugify(selectedOutlet.name)}`, { replace: true });
  }, [navigate, params.outletSlug, selectedOutlet]);

  const baseOutletReservations = useMemo(() => {
    if (!selectedOutlet) return [];
    if (selectedOutlet.aggregate) {
      const childNames = new Set([selectedOutlet.name, ...(selectedOutlet.children || [])]);
      return reservations.filter((reservation) => childNames.has(outletNameForReservation(reservation)));
    }
    return reservations.filter((reservation) => outletNameForReservation(reservation) === selectedOutlet.name);
  }, [reservations, selectedOutlet]);

  const outletReservations = useMemo(() => {
    if (!selectedOutlet) return [];
    const query = search.trim().toLowerCase();
    const rows = baseOutletReservations.filter((reservation) => {
      const outlet = outletNameForReservation(reservation);
      if (!isWithinRange(reservation.event_date, startDate, endDate)) return false;
      const status = normalizeStatus(reservation.status);
      if (statusFilter !== "all" && status !== statusFilter) return false;
      const eventType = eventTypeFor(reservation, outlet).toLowerCase();
      if (typeFilter !== "all" && eventType !== typeFilter) return false;
      if (!query) return true;
      return [
        reservation.name,
        reservation.email,
        reservation.phone,
        reservation.reference_code,
        reservation.table_number,
        reservation.seat_number,
      ].some((value) => String(value || "").toLowerCase().includes(query));
    });

    return [...rows].sort((a, b) => {
      if (sortBy === "date_desc") return compareEventDate(b, a);
      if (sortBy === "guest_desc") return Number(b.guests_count || 0) - Number(a.guests_count || 0);
      if (sortBy === "status") return normalizeStatus(a.status).localeCompare(normalizeStatus(b.status));
      return compareEventDate(a, b);
    });
  }, [baseOutletReservations, endDate, search, selectedOutlet, sortBy, startDate, statusFilter, typeFilter]);

  const statusCounts = useMemo(() => {
    return outletReservations.reduce((acc, reservation) => {
      const status = normalizeStatus(reservation.status);
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, { reserved: 0, pending: 0, declined: 0, cancelled: 0 });
  }, [outletReservations]);

  const total = outletReservations.length;
  const guests = outletReservations.reduce((sum, reservation) => sum + Number(reservation.guests_count || reservation.guests || 0), 0);
  const pending = outletReservations.filter((reservation) => normalizeStatus(reservation.status) === "pending");
  const reserved = outletReservations.filter((reservation) => normalizeStatus(reservation.status) === "reserved");
  const nextReservation = [...outletReservations].filter((reservation) => normalizeStatus(reservation.status) !== "declined").sort(compareEventDate)[0];
  const acceptanceRate = total ? Math.round((reserved.length / total) * 100) : 0;
  const todayCount = outletReservations.filter((reservation) => reservation.event_date === today()).length;
  const pendingByPriority = useMemo(() => {
    return [...pending].sort((a, b) => pendingAgeMinutes(b) - pendingAgeMinutes(a) || compareEventDate(a, b));
  }, [pending]);
  const urgentPending = pendingByPriority.filter((reservation) => responsePriority(reservation).label === "Overdue");
  const reviewSoon = pendingByPriority.filter((reservation) => responsePriority(reservation).label === "Review soon");
  const oldestPending = pendingByPriority[0];

  const trendRows = useMemo(() => {
    if (analyticsPeriod === "yearly") {
      const year = Number(startDate?.slice(0, 4)) || new Date().getFullYear();
      return Array.from({ length: 12 }, (_, month) => {
        const key = `${year}-${String(month + 1).padStart(2, "0")}`;
        return {
          date: `${key}-01`,
          label: readableMonth(month),
          count: baseOutletReservations.filter((reservation) => {
            if (!String(reservation.event_date || "").startsWith(key)) return false;
            const status = normalizeStatus(reservation.status);
            if (statusFilter !== "all" && status !== statusFilter) return false;
            const eventType = eventTypeFor(reservation, selectedOutlet?.name).toLowerCase();
            if (typeFilter !== "all" && eventType !== typeFilter) return false;
            return true;
          }).length,
        };
      });
    }
    const days = [];
    const cursor = new Date(`${startDate}T00:00:00`);
    const end = new Date(`${endDate}T00:00:00`);
    while (!Number.isNaN(cursor.getTime()) && !Number.isNaN(end.getTime()) && cursor <= end && days.length < 45) {
      const key = cursor.toISOString().slice(0, 10);
      days.push({ date: key, count: outletReservations.filter((reservation) => reservation.event_date === key).length });
      cursor.setDate(cursor.getDate() + 1);
    }
    return days.length ? days : [{ date: today(), count: total }];
  }, [analyticsPeriod, baseOutletReservations, endDate, outletReservations, selectedOutlet?.name, startDate, statusFilter, total, typeFilter]);

  const typeRows = useMemo(() => {
    const map = new Map();
    outletReservations.forEach((reservation) => {
      const label = eventTypeFor(reservation, selectedOutlet?.name);
      map.set(label, (map.get(label) || 0) + 1);
    });
    return Array.from(map.entries()).map(([label, value], index) => ({
      label,
      value,
      color: [C.gold, C.green, C.blue, C.slate][index % 4],
    }));
  }, [outletReservations, selectedOutlet?.name]);

  const quickStats = reports.summary || {};

  return (
    <div style={{ minHeight: "100vh", background: C.page, fontFamily: F.body }}>
      <style>{`
        @keyframes odFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes odDraw { from { stroke-dashoffset: 650; } to { stroke-dashoffset: 0; } }
        @keyframes odFadeArea { from { opacity: 0; } to { opacity: 1; } }
        @keyframes odGrow { from { width: 0; } }
        .od-card, .od-panel { animation: odFade 0.28s ease both; }
        .od-line { stroke-dasharray: 650; stroke-dashoffset: 650; animation: odDraw 0.85s ease forwards; }
        .od-area { opacity: 0; animation: odFadeArea 0.65s ease 0.18s forwards; }
        .od-donut { transition: stroke-dasharray 0.35s ease; }
        .od-bar { animation: odGrow 0.55s ease both; }
        @media (max-width: 980px) {
          .od-top, .od-two, .od-filters { grid-template-columns: 1fr !important; }
          .od-row { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <AdminNavbar />
      <div style={{ display: "flex" }}>
        <Sidebar
          activeNav="outlets"
          isOpen={sidebarOpen}
          onToggle={() => setSidebarOpen(!sidebarOpen)}
          pending={quickStats.pending || 0}
          approved={quickStats.reserved || quickStats.approved || 0}
          rejected={quickStats.rejected || 0}
          cancelled={quickStats.cancelled || 0}
        />
        <main style={{ flex: 1, height: "calc(100vh - 60px)", overflow: "auto", padding: "26px 32px" }}>
          <div className="od-top" style={{ display: "grid", gridTemplateColumns: "minmax(260px,1fr) auto", gap: 18, alignItems: "end", marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.22em", textTransform: "uppercase", color: C.gold, marginBottom: 6 }}>Outlet Operations</div>
              <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, color: C.text, fontWeight: 680 }}>{selectedOutlet?.name || "Outlet Dashboard"}</h1>
              <div style={{ marginTop: 7, fontSize: 12.5, color: C.muted }}>
                {selectedOutlet?.aggregate
                  ? `${selectedOutlet.wing} grouped dashboard - combined tracking for ${selectedOutlet.children.length} sub-rooms from ${readableDate(startDate)} to ${readableDate(endDate)}`
                  : selectedOutlet
                    ? `${outletGroupLabel(selectedOutlet.name)} dashboard - isolated operational tracking from ${readableDate(startDate)} to ${readableDate(endDate)}`
                    : "Dedicated monitoring view for assigned outlet operations."}
              </div>
            </div>
            {selectedOutlet && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <span style={{ borderRadius: 999, padding: "5px 9px", background: wsStatus === "connected" ? C.greenFaint : wsStatus === "polling" ? C.goldFaint : C.slateFaint, border: `1px solid ${wsStatus === "connected" ? "rgba(46,122,90,0.18)" : wsStatus === "polling" ? "rgba(140,107,42,0.22)" : C.border}`, color: wsStatus === "connected" ? C.green : wsStatus === "polling" ? C.gold : C.muted, fontSize: 11, fontWeight: 750 }}>
                  {syncing ? "Syncing" : wsStatus === "connected" ? "Live" : wsStatus === "polling" ? "Polling" : "Reconnecting"}
                </span>
                <StatusPill status={canManageReservations ? "reserved" : "pending"} />
                <span style={{ borderRadius: 999, padding: "5px 9px", background: C.soft, border: `1px solid ${C.border}`, color: C.muted, fontSize: 11, fontWeight: 700 }}>{currentUser?.role || "admin"}</span>
              </div>
            )}
          </div>

          {!canViewReports ? (
            <Panel>
              <div style={{ padding: 22, color: C.muted }}>Your account can access admin pages, but does not have outlet dashboard visibility.</div>
            </Panel>
          ) : error ? (
            <Panel><div style={{ padding: 16, color: C.red }}>{error}</div></Panel>
          ) : loading ? (
            <Panel><div style={{ padding: 24, color: C.muted }}>Loading outlet dashboard...</div></Panel>
          ) : !selectedOutlet ? (
            <Panel><div style={{ padding: 24, color: C.muted }}>No accessible outlets found for this account.</div></Panel>
          ) : (
            <div style={{ display: "grid", gap: 16 }}>
              <Panel style={{ overflow: "visible", position: "relative", zIndex: 5 }}>
                <div className="od-filters" style={{ padding: 13, display: "grid", gridTemplateColumns: "minmax(260px,1.5fr) 130px 130px 130px 130px 1fr 130px auto", gap: 9, alignItems: "end" }}>
                  <Field label="Outlet">
                    <OutletSelector outlets={selectableOutlets} selectedOutlet={selectedOutlet} onSelect={(outlet) => navigate(`/admin/outlets/${slugify(outlet.name)}`)} />
                  </Field>
                  <Field label="Start"><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} style={inputStyle()} /></Field>
                  <Field label="End"><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} style={inputStyle()} /></Field>
                  <Field label="Status">
                    <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} style={inputStyle()}>
                      <option value="all">All</option>
                      <option value="pending">Pending</option>
                      <option value="reserved">Approved</option>
                      <option value="declined">Declined</option>
                      <option value="cancelled">Completed/Cancelled</option>
                    </select>
                  </Field>
                  <Field label="Event Type">
                    <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} style={inputStyle()}>
                      <option value="all">All</option>
                      <option value="room/table">Room/Table</option>
                      <option value="individual seat">Individual Seat</option>
                      <option value="standalone">Standalone</option>
                      <option value="dine-in">Dine-in</option>
                    </select>
                  </Field>
                  <Field label="Search">
                    <div style={{ ...inputStyle({ display: "flex", alignItems: "center", gap: 8 }) }}>
                      <Search size={14} color={C.faint} />
                      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Guest, email, reference" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 12, color: C.text }} />
                    </div>
                  </Field>
                  <Field label="Sort">
                    <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} style={inputStyle()}>
                      <option value="date_asc">Earliest first</option>
                      <option value="date_desc">Latest first</option>
                      <option value="guest_desc">Guests high to low</option>
                      <option value="status">Status A-Z</option>
                    </select>
                  </Field>
                  <button onClick={() => loadDashboard(false)} disabled={loading || syncing} style={{ height: 38, border: "none", borderRadius: 9, background: C.gold, color: "#fff", padding: "0 14px", fontFamily: F.label, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", cursor: loading || syncing ? "not-allowed" : "pointer" }}>
                    {syncing ? "Syncing" : "Apply"}
                  </button>
                </div>
              </Panel>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
                <MetricCard icon={CalendarDays} label="Reservations" value={total} detail="in range" color={C.blue} bg={C.blueFaint} />
                <MetricCard icon={Clock} label="Pending Actions" value={pending.length} detail={urgentPending.length ? `${urgentPending.length} overdue` : "awaiting review"} color={urgentPending.length ? C.red : C.gold} bg={urgentPending.length ? C.redFaint : C.goldFaint} />
                <MetricCard icon={CheckCircle} label="Approved" value={reserved.length} detail={`${acceptanceRate}% rate`} color={C.green} bg={C.greenFaint} />
                <MetricCard icon={Activity} label="Today" value={todayCount} detail="scheduled" color={C.blue} bg={C.blueFaint} />
                <MetricCard icon={Users} label="Guests" value={guests} detail="expected" color={C.slate} bg={C.slateFaint} />
              </div>

              <div className="od-two" style={{ display: "grid", gridTemplateColumns: "minmax(360px,1.35fr) minmax(300px,0.8fr)", gap: 14 }}>
                <Panel
                  title="Reservation Trend"
                  subtitle={analyticsPeriod === "yearly" ? `Monthly activity for ${startDate?.slice(0, 4) || new Date().getFullYear()}.` : "Scheduled activity for the selected date range."}
                  right={<PeriodSwitch value={analyticsPeriod} onChange={setAnalyticsPeriod} />}
                >
                  <LineChart rows={trendRows} period={analyticsPeriod} />
                </Panel>
                <Panel title="Status Distribution" subtitle="Current workflow state for filtered reservations.">
                  <DonutChart counts={statusCounts} total={total} />
                </Panel>
              </div>

              <div className="od-two" style={{ display: "grid", gridTemplateColumns: "minmax(320px,1fr) minmax(320px,1fr)", gap: 14 }}>
                <Panel title="Live Operational Monitoring" subtitle="Next confirmed or pending activity for this outlet.">
                  <div style={{ padding: 16, display: "grid", gap: 12 }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
                      <MetricCard icon={TrendingUp} label="Acceptance" value={`${acceptanceRate}%`} detail="approved" color={C.green} bg={C.greenFaint} />
                      <MetricCard icon={AlertCircle} label="Response Watch" value={urgentPending.length + reviewSoon.length} detail="needs attention" color={urgentPending.length ? C.red : C.gold} bg={urgentPending.length ? C.redFaint : C.goldFaint} />
                    </div>
                    <div style={{ padding: 13, borderRadius: 10, background: C.soft, border: `1px solid ${C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: C.gold, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}><AlertCircle size={14} />Next Activity</div>
                      {nextReservation ? (
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                          <strong>{nextReservation.name || "Guest"}</strong> on {readableDate(nextReservation.event_date)} at {readableTime(nextReservation.event_time)}.
                          <div style={{ color: C.muted }}>{eventTypeFor(nextReservation, selectedOutlet.name)} - {nextReservation.guests_count || 0} guests</div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: C.muted }}>No upcoming activity in the selected range.</div>
                      )}
                    </div>
                    <div style={{ padding: 13, borderRadius: 10, background: oldestPending ? responsePriority(oldestPending).bg : C.soft, border: `1px solid ${oldestPending ? `${responsePriority(oldestPending).color}30` : C.border}` }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, color: oldestPending ? responsePriority(oldestPending).color : C.muted, fontSize: 10, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 8 }}><Clock size={14} />Oldest Pending Request</div>
                      {oldestPending ? (
                        <div style={{ fontSize: 13, color: C.text, lineHeight: 1.6 }}>
                          <strong>{oldestPending.name || "Guest"}</strong> has waited {formatAge(responsePriority(oldestPending).minutes)}.
                          <div style={{ color: C.muted }}>{oldestPending.reference_code || "-"} · {readableDate(oldestPending.event_date)} at {readableTime(oldestPending.event_time)}</div>
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: C.muted }}>No pending requests need review.</div>
                      )}
                    </div>
                  </div>
                </Panel>
                <Panel title="Event Type Mix" subtitle="Operational demand by reservation type.">
                  <BarChart rows={typeRows.length ? typeRows : [{ label: "No activity", value: 0, color: C.slate }]} />
                </Panel>
              </div>

              <div className="od-two" style={{ display: "grid", gridTemplateColumns: "minmax(320px,1.1fr) minmax(320px,0.9fr)", gap: 14 }}>
                <Panel
                  title="Pending Approvals"
                  subtitle="Reservations that need outlet action."
                  right={<button onClick={() => navigate("/admin/reservations")} style={{ height: 30, border: `1px solid ${C.border}`, borderRadius: 8, background: C.surface, color: C.gold, padding: "0 10px", fontSize: 10, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", cursor: "pointer" }}>Open Queue</button>}
                >
                  <div style={{ maxHeight: 310, overflow: "auto" }}>
                    {pendingByPriority.length ? pendingByPriority.slice(0, 8).map((reservation) => <ReservationRow key={reservation.id || reservation.reference_code} reservation={reservation} showPriority />) : (
                      <div style={{ padding: 18, color: C.muted, fontSize: 12 }}>No pending approvals for this outlet.</div>
                    )}
                  </div>
                </Panel>
                <Panel title="Notifications & Alerts" subtitle="Operational signals based on current filters.">
                  <div style={{ padding: 16, display: "grid", gap: 10 }}>
                    <AlertRow icon={AlertCircle} label="Overdue review" value={urgentPending.length} detail="Pending requests older than 2 hours" color={urgentPending.length ? C.red : C.slate} />
                    <AlertRow icon={Clock} label="Review soon" value={reviewSoon.length} detail="Pending requests approaching review threshold" color={reviewSoon.length ? C.gold : C.slate} />
                    <AlertRow icon={CheckCircle} label="Approved reservations" value={reserved.length} detail="Confirmed outlet activity" color={C.green} />
                    <AlertRow icon={Layers} label="Outlet scope" value={selectedOutlet.aggregate ? selectedOutlet.children.length : 1} detail={selectedOutlet.aggregate ? "Sub-rooms included in grouped monitoring" : "Current operational outlet"} color={C.slate} />
                  </div>
                </Panel>
              </div>

              <Panel title="Reservation Worklist" subtitle="Filtered operational records for this outlet.">
                <div style={{ maxHeight: 420, overflow: "auto" }}>
                  {outletReservations.length ? outletReservations.map((reservation) => <ReservationRow key={reservation.id || reservation.reference_code} reservation={reservation} />) : (
                    <div style={{ padding: 20, color: C.muted, fontSize: 12 }}>No reservations match the selected filters.</div>
                  )}
                </div>
              </Panel>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function AlertRow({ icon: Icon, label, value, detail, color }) {
  return (
    <div style={{ border: `1px solid ${C.divider}`, borderRadius: 10, padding: 11, display: "grid", gridTemplateColumns: "32px minmax(0,1fr) auto", gap: 10, alignItems: "center", background: C.soft }}>
      <span style={{ width: 32, height: 32, borderRadius: 9, background: `${color}14`, color, display: "grid", placeItems: "center" }}><Icon size={15} /></span>
      <span style={{ minWidth: 0 }}>
        <span style={{ display: "block", fontSize: 12.5, fontWeight: 700, color: C.text }}>{label}</span>
        <span style={{ display: "block", marginTop: 2, fontSize: 11.5, color: C.muted, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</span>
      </span>
      <strong style={{ fontSize: 18, color }}>{value}</strong>
    </div>
  );
}

export default OutletDashboard;
