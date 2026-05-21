import { useEffect, useMemo, useState } from "react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
import Sidebar from "../../../components/layout/Sidebar";
import { authAPI } from "../../../services/authAPI";
import { reportAPI } from "../../../services/reportAPI";
import { Building2, Download, Layers, Printer, Utensils } from "lucide-react";
import { canAccessOutlet, canonicalOutletName } from "../../../constants/outletCatalog";
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
    <div style={{ display: "grid", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 12, color: C.muted }}>
        <span>{label}</span>
        <span>{value} <span style={{ color: C.faint }}>({pct}%)</span></span>
      </div>
      <div style={{ height: 7, borderRadius: 999, background: "rgba(0,0,0,0.05)", overflow: "hidden" }}>
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

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
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

function OutletCard({ outlet }) {
  const total = outlet.total_reservations || 0;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, display: "grid", gap: 12, minWidth: 0, overflow: "hidden" }}>
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
                {["Time", "Reference", "Guest", "Outlet / Room", "Change", "Action", "Notes"].map((header) => (
                  <th key={header} style={tableHeadStyle()}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "16px 12px", color: C.muted }}>No transactions found for this date range.</td>
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

function MonthlyLineChart({ months }) {
  const data = (months || []).map((month) => ({
    ...month,
    label: month.label || month.month,
    reservations: Number(month.reservations || 0),
    promotion_mentions: Number(month.promotion_mentions || 0),
  }));
  const labelInterval = data.length > 16 ? Math.ceil(data.length / 8) - 1 : 0;

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: C.muted }}>Reservation volume by month, with promotion mentions shown as a comparison line.</div>
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
            <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(140,107,42,0.22)", strokeDasharray: "4 4" }} wrapperStyle={{ outline: "none" }} />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="plainline"
              wrapperStyle={{ fontSize: 11, color: C.muted, paddingBottom: 12 }}
              payload={[
                { value: "Reservations", type: "plainline", color: C.blue },
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

function MonthlyReports({ monthlyReport }) {
  const months = monthlyReport.months || [];
  const outlets = monthlyReport.outlets || [];
  const summary = monthlyReport.summary || {};
  const reservations = summary.reservations || 0;
  const reserved = summary.reserved || summary.approved || 0;
  const approvalRate = reservations ? Math.round((reserved / reservations) * 100) : 0;
  const peakMonth = summary.peak_month || months.reduce((best, month) => ((month.reservations || 0) > (best.reservations || 0) ? month : best), {}).label || "-";
  const promoMonth = months.reduce((best, month) => ((month.promotion_mentions || 0) > (best.promotion_mentions || 0) ? month : best), {}).label || "-";
  const activeMonths = months.filter((month) => (month.reservations || 0) > 0).length;
  const topOutlet = outlets[0];

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
        <MetricCard label="Year Total" value={reservations} detail={`${activeMonths} active months`} tone="blue" />
        <MetricCard label="Approval Rate" value={`${approvalRate}%`} detail={`${reserved} approved`} tone="green" />
        <MetricCard label="Peak Month" value={peakMonth} tone="gold" />
        <MetricCard label="Promotions" value={summary.promotion_mentions || 0} detail="mentions" tone="slate" />
      </div>

      <div className="reports-grid" style={{ display: "grid", gridTemplateColumns: "minmax(320px,1.2fr) minmax(280px,0.8fr)", gap: 14 }}>
        <SummaryPanel title={`Monthly Trend ${monthlyReport.year || ""}`}>
          <div style={{ display: "grid", gap: 12 }}>
            <MonthlyLineChart months={months} />
          </div>
        </SummaryPanel>

        <SummaryPanel title="Monthly Management Highlights">
          <div style={{ display: "grid", gap: 12 }}>
            <InsightRow label="Busiest month" value={peakMonth} detail="Highest reservation volume in the selected year." tone="gold" />
            <InsightRow label="Top outlet" value={topOutlet?.outlet || "-"} detail={topOutlet ? `${topOutlet.reservations || 0} reservations recorded.` : "No outlet activity yet."} tone="blue" />
            <InsightRow label="Promotion activity" value={promoMonth} detail={`${summary.promotion_mentions || 0} total promotion mentions.`} tone="slate" />
            <InsightRow label="Reservation health" value={`${approvalRate}% approved`} detail="Quick read for monthly operations review." tone="green" />
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
          title="Top Outlets This Year"
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
            <MonthlyLineChart months={months} />
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

function TableCard({ title, headers, rows, renderRow, actions }) {
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
  const [selectedOutlet, setSelectedOutlet] = useState("ALL");
  const [selectedOutletGroup, setSelectedOutletGroup] = useState("all");
  const [outletSort, setOutletSort] = useState({ key: "total_reservations", direction: "desc" });
  const [roomSort, setRoomSort] = useState({ key: "reservations", direction: "desc" });
  const [auditSort, setAuditSort] = useState({ key: "created_at", direction: "desc" });
  const [report, setReport] = useState({ summary: {}, data: [] });
  const [transactionReport, setTransactionReport] = useState({ summary: {}, data: [] });
  const [monthlyReport, setMonthlyReport] = useState({ summary: {}, months: [], outlets: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const canViewReports = authAPI.hasPermission("view_outlet_reports");
  const canViewTransactions = authAPI.hasPermission("view_transactions");
  const canViewGlobalReports = authAPI.hasPermission("view_global_reports");
  const currentUser = useMemo(() => authAPI.getCurrentUser(), []);

  const loadReport = async () => {
    if (!canViewReports) return;
    setLoading(true);
    setError("");

    try {
      const selectedYear = Number(reportYear) || Number(today().slice(0, 4));
      const [outletData, transactionData, monthlyData] = await Promise.all([
        reportAPI.getOutletReports({ start_date: startDate, end_date: endDate }),
        canViewTransactions
          ? reportAPI.getTransactionReports({ start_date: startDate, end_date: endDate })
          : Promise.resolve(null),
        reportAPI.getMonthlyReports({ year: selectedYear }),
      ]);
      setReport(outletData);
      if (transactionData) setTransactionReport(transactionData);
      setMonthlyReport(monthlyData);
    } catch (err) {
      setError(err.message || "Failed to load outlet report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReport();
  }, []);

  const filteredOutlets = useMemo(() => {
    const rows = (report.data || []).filter((row) => canAccessOutlet(currentUser, row.name));
    const outletFiltered = selectedOutlet === "ALL"
      ? rows
      : rows.filter((row) => String(row.name) === selectedOutlet);
    const groupFiltered = selectedOutletGroup === "all"
      ? outletFiltered
      : outletFiltered.filter((row) => outletGroup(row) === selectedOutletGroup);
    return sortRows(groupFiltered, outletSort);
  }, [currentUser, report.data, selectedOutlet, selectedOutletGroup, outletSort]);

  const summary = report.summary || {};
  const category = report.category_breakdown || {};
  const statuses = report.status_breakdown || {};
  const roomDetails = useMemo(
    () => sortRows((report.room_details || []).filter((row) => canAccessOutlet(currentUser, row.room)), roomSort),
    [currentUser, report.room_details, roomSort]
  );
  const allOutlets = useMemo(
    () => (report.data || []).filter((row) => canAccessOutlet(currentUser, row.name)),
    [currentUser, report.data]
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
    if (!outletOptions.includes(canonicalOutletName(selectedOutlet))) {
      setSelectedOutlet("ALL");
    }
  }, [outletOptions, selectedOutlet]);

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
  const reservedCount = (statuses.reserved || 0) + (statuses.approved || 0);
  const totalReservations = summary.reservations || 0;
  const handleExportCsv = () => {
    const rows = [
      ["Report", "Outlet Performance"],
      ["Date Range", dateRangeLabel],
      [],
      ["Summary"],
      ["Reservations", summary.reservations || 0],
      ["Guests", summary.guests || 0],
      ["Outlets", summary.outlets || 0],
      ["Transactions", transactionSummary.transactions || 0],
      [],
      ["Status", "Count"],
      ["Reserved", reservedCount],
      ["Pending", statuses.pending || 0],
      ["Rejected", statuses.rejected || 0],
      ["Cancelled", statuses.cancelled || 0],
      [],
      ["Monthly", "Reservations", "Promotion Mentions"],
      ...(monthlyReport.months || []).map((month) => [month.label, month.reservations || 0, month.promotion_mentions || 0]),
      [],
      ["Outlet", "Reservations", "Guests", "Reserved", "Pending", "Rejected", "Cancelled", "Dine-In", "Promo"],
      ...filteredOutlets.map((outlet) => [
        outlet.name,
        outlet.total_reservations || 0,
        outlet.guests || 0,
        outlet.reserved || 0,
        outlet.pending || 0,
        outlet.rejected || 0,
        outlet.cancelled || 0,
        outlet.dine_in || 0,
        outlet.promotion_mentions || 0,
      ]),
    ];
    downloadCsv(isTrendTab ? `outlet-report-${reportYear}.csv` : `outlet-report-${startDate}-to-${endDate}.csv`, rows);
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
      description: "Year-based reporting for monthly and annual trends.",
      tabs: [
        { id: "monthly", label: "Monthly" },
        { id: "yearly", label: "Yearly" },
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
  const filterModeLabel = isTrendTab ? `${reportYear} trend reporting` : `${dateRangeLabel} date range`;

  return (
    <div style={{ minHeight: "100vh", background: C.page, fontFamily: F.body }}>
      <style>{`
        @media print {
          body { background: #fff !important; }
          aside, nav, header { display: none !important; }
          main { height: auto !important; overflow: visible !important; padding: 18px !important; }
          button, select, input { box-shadow: none !important; }
        }
        @keyframes reportsFadeIn {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .reports-section {
          animation: reportsFadeIn 0.22s ease both;
        }
        .reports-table-row {
          transition: background 0.14s ease;
        }
        .reports-table-row:hover {
          background: rgba(140,107,42,0.035);
        }
        @media (max-width: 980px) {
          .reports-top, .reports-grid, .reports-toolbar, .reports-nav-grid { grid-template-columns: 1fr !important; }
          .reports-filter-panel { min-width: 0 !important; }
        }
      `}</style>
      <AdminNavbar />
      <div style={{ display: "flex" }}>
        <Sidebar activeNav="reports" isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main style={{ flex: 1, height: "calc(100vh - 60px)", overflow: "auto", padding: "30px 32px 42px" }}>
          <AdminPageHeader
            eyebrow="Reports"
            title="Outlet Performance"
            description={canViewReports ? `${activeReport?.label || "Reports"} uses ${filterModeLabel}.` : "Performance reporting and export tools for authorized administrators."}
            C={C}
            F={F}
            actions={canViewReports && (
              <div className="reports-filter-panel" style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, padding: 12, display: "grid", gap: 10, minWidth: 320 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                  <div>
                    <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>{isTrendTab ? "Trend Filter" : "Date Range Filter"}</div>
                    <div style={{ marginTop: 2, fontSize: 11.5, color: C.muted }}>{isTrendTab ? "Monthly and yearly reports use the selected year only." : "Summary, outlets, and audit trail use this date range."}</div>
                  </div>
                  <span style={{ borderRadius: 999, background: isTrendTab ? C.blueFaint : C.goldFaint, color: isTrendTab ? C.blue : C.gold, padding: "5px 8px", fontSize: 9.5, fontWeight: 800, letterSpacing: "0.10em", textTransform: "uppercase", whiteSpace: "nowrap" }}>
                    {isTrendTab ? "Year" : "Range"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {isTrendTab ? (
                    <FilterField label="Report Year">
                      <select value={reportYear} onChange={(e) => setReportYear(e.target.value)} style={{ ...filterStyle(), minWidth: 150 }}>
                        {yearOptions.map((year) => <option key={year} value={String(year)}>{year}</option>)}
                      </select>
                    </FilterField>
                  ) : (
                    <>
                      <FilterField label="Start">
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={filterStyle()} />
                      </FilterField>
                      <FilterField label="End">
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={filterStyle()} />
                      </FilterField>
                      {showOutletFilter && (
                        <FilterField label="Outlet">
                          <select value={selectedOutlet} onChange={(e) => setSelectedOutlet(e.target.value)} style={{ ...filterStyle(), minWidth: 190 }}>
                            <option value="ALL">All outlets</option>
                            {allOutlets.map((outlet) => <option key={outlet.name || outlet.venue_id} value={String(outlet.name)}>{outlet.name}</option>)}
                          </select>
                        </FilterField>
                      )}
                    </>
                  )}
                <button onClick={loadReport} disabled={loading} style={{ height: 38, padding: "0 14px", border: "none", borderRadius: 8, background: C.gold, color: "#fff", fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer" }}>
                  {loading ? "Loading" : "Apply"}
                </button>
                <ActionButton icon={Download} label="CSV" onClick={handleExportCsv} />
                <ActionButton icon={Printer} label="Print" onClick={() => window.print()} />
                </div>
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
                  <Section title="Overview" subtitle="High-level submission activity for the selected date range.">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
                      <MetricCard label="Reservations" value={summary.reservations || 0} tone="blue" />
                      <MetricCard label="Guests" value={summary.guests || 0} tone="green" />
                      <MetricCard label="Outlets" value={summary.outlets || 0} tone="gold" />
                      <MetricCard label="Transactions" value={transactionSummary.transactions || 0} detail={canViewTransactions ? "read-only" : ""} tone="slate" />
                    </div>
                  </Section>

                  <div className="reports-grid" style={{ display: "grid", gridTemplateColumns: "minmax(280px,1.05fr) minmax(280px,0.95fr)", gap: 14 }}>
                    <SummaryPanel title="Reservation Status">
                      <div style={{ display: "grid", gap: 12 }}>
                        <ProgressRow label="Reserved" value={reservedCount} total={totalReservations} tone="green" />
                        <ProgressRow label="Pending" value={statuses.pending || 0} total={totalReservations} tone="gold" />
                        <ProgressRow label="Rejected" value={statuses.rejected || 0} total={totalReservations} tone="red" />
                        <ProgressRow label="Cancelled" value={statuses.cancelled || 0} total={totalReservations} tone="slate" />
                      </div>
                    </SummaryPanel>

                    <SummaryPanel title="Reservation Mix">
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(130px,1fr))", gap: 10 }}>
                        <MetricCard label="Dine-In" value={category.dine_in?.reservations || 0} detail={`${category.dine_in?.guests || 0} guests`} tone="green" />
                        <MetricCard label="Rooms" value={category.room_reservations?.reservations || 0} detail={`${category.room_reservations?.guests || 0} guests`} tone="gold" />
                        <MetricCard label="Promo" value={category.promotion_mentions?.reservations || 0} detail="mentions" tone="blue" />
                      </div>
                    </SummaryPanel>
                  </div>
                </>
              )}

              {activeTab === "monthly" && (
                <Section title="Monthly Reporting" subtitle="Year-to-date monthly view based on scheduled event dates, with promotions, outlet activity, and statuses.">
                  <MonthlyReports monthlyReport={monthlyReport} />
                </Section>
              )}

              {activeTab === "yearly" && (
                <Section title="Yearly Management Report" subtitle="Annual view for performance review, presentation reporting, and management-level decisions.">
                  <YearlyReports monthlyReport={monthlyReport} transactionSummary={transactionSummary} />
                </Section>
              )}

              {activeTab === "outlets" && (
                <Section title="Outlet Performance" subtitle="Grouped by outlet type. Use the filters and sort dropdowns to inspect rooms, dining outlets, and exact room totals.">
                  <div style={{ display: "grid", gap: 14 }}>
                    <ReportCard style={{ padding: 12 }}>
                      <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,0.8fr) minmax(280px,1.2fr)", gap: 12, alignItems: "center" }}>
                        <div style={{ display: "grid", gridTemplateColumns: `repeat(${1 + (roomOutletCount > 0 ? 1 : 0) + (diningOutletCount > 0 ? 1 : 0)},minmax(0,1fr))`, gap: 8 }}>
                          <FilterChip icon={Layers} label="All" count={allOutlets.length} active={selectedOutletGroup === "all"} onClick={() => setSelectedOutletGroup("all")} />
                          {roomOutletCount > 0 && <FilterChip icon={Building2} label="Rooms" count={roomOutletCount} active={selectedOutletGroup === "rooms"} onClick={() => setSelectedOutletGroup("rooms")} />}
                          {diningOutletCount > 0 && <FilterChip icon={Utensils} label="Dining" count={diningOutletCount} active={selectedOutletGroup === "dining"} onClick={() => setSelectedOutletGroup("dining")} />}
                        </div>
                        <div style={{ display: "flex", justifyContent: "flex-end" }}>
                          <SortSelect value={outletSort} options={SORT_OPTIONS.outlets} onChange={setOutletSort} />
                        </div>
                      </div>
                    </ReportCard>

                    <div style={{ display: "grid", gap: 16 }}>
                      {outletSections.map((section) => (
                        <div key={section.wing} style={{ display: "grid", gap: 10 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                            <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 750, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold }}>{section.wing}</div>
                            <div style={{ height: 1, background: C.divider, flex: 1 }} />
                            <div style={{ color: C.faint, fontSize: 11, fontWeight: 650 }}>{section.rows.length} outlet{section.rows.length === 1 ? "" : "s"}</div>
                          </div>
                          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%, 300px),1fr))", gap: 12 }}>
                            {section.rows.map((outlet) => <OutletCard key={outlet.name || outlet.venue_id} outlet={outlet} />)}
                          </div>
                        </div>
                      ))}
                    </div>

                    <TableCard
                      title="Room Totals"
                      actions={
                        <SortSelect value={roomSort} options={SORT_OPTIONS.rooms} onChange={setRoomSort} />
                      }
                      headers={["Room / Outlet", "Reservations", "Guests", "Pending", "Reserved", "Rejected", "Cancelled", "Dine-In", "Promo", "Latest Event"]}
                      rows={roomDetails}
                      renderRow={(room) => (
                        <tr key={room.room}>
                          <td style={cellStyle(true)}>{room.room}</td>
                          <td style={cellStyle()}>{room.reservations}</td>
                          <td style={cellStyle()}>{room.guests}</td>
                          <td style={cellStyle()}>{room.pending}</td>
                          <td style={cellStyle()}>{room.reserved}</td>
                          <td style={cellStyle()}>{room.rejected}</td>
                          <td style={cellStyle()}>{room.cancelled}</td>
                          <td style={cellStyle()}>{room.dine_in}</td>
                          <td style={cellStyle()}>{room.promotion_mentions}</td>
                          <td style={cellStyle()}>{room.latest_event_date || "-"}</td>
                        </tr>
                      )}
                    />
                  </div>
                </Section>
              )}

              {activeTab === "audit" && canViewTransactions && (
                <Section title="Audit Trail" subtitle="Read-only status changes for operational review.">
                  <TransactionMonitor transactionReport={transactionReport} isGlobal={canViewGlobalReports} sort={auditSort} onSort={setAuditSort} />
                </Section>
              )}
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <label style={{ display: "grid", gap: 5 }}>
      <span style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint }}>{label}</span>
      {children}
    </label>
  );
}

function filterStyle() {
  return {
    height: 38,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    background: C.surface,
    color: C.text,
    padding: "0 10px",
    fontFamily: F.body,
    fontSize: 12,
    outline: "none",
  };
}

function pagerButtonStyle() {
  return {
    height: 34,
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
    padding: "10px 12px",
    borderBottom: `1px solid ${C.divider}`,
    color: C.faint,
    fontWeight: 750,
    whiteSpace: "nowrap",
  };
}

function cellStyle(strong = false) {
  return {
    padding: "11px 12px",
    borderBottom: `1px solid ${C.divider}`,
    color: strong ? C.text : C.muted,
    fontWeight: strong ? 650 : 550,
    whiteSpace: "nowrap",
  };
}
