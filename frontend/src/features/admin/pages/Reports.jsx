import { useEffect, useMemo, useState } from "react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import Sidebar from "../../../components/layout/Sidebar";
import { authAPI } from "../../../services/authAPI";
import { reportAPI } from "../../../services/reportAPI";
import { Building2, Download, Layers, Printer, Utensils } from "lucide-react";

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
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, boxShadow: "0 10px 30px rgba(24,20,14,0.04)", ...style }}>
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
  const rows = sortRows(transactionReport.data || [], sort);

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

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <SortSelect value={sort} options={SORT_OPTIONS.audit} onChange={onSort} />
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
              ) : rows.slice(0, 12).map((row) => {
                const reservation = row.reservation || {};
                const venue = row.venue || {};
                return (
                  <tr key={row.id}>
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
      </div>
    </SummaryPanel>
  );
}

function MonthlyLineChart({ months }) {
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const width = 720;
  const height = 250;
  const padding = { top: 18, right: 24, bottom: 34, left: 36 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(1, ...months.map((month) => Math.max(month.reservations || 0, month.promotion_mentions || 0)));
  const xFor = (index) => padding.left + (months.length <= 1 ? 0 : (index / (months.length - 1)) * innerWidth);
  const yFor = (value) => padding.top + innerHeight - ((value || 0) / maxValue) * innerHeight;
  const pointsFor = (key) => months.map((month, index) => `${xFor(index)},${yFor(month[key] || 0)}`).join(" ");
  const reservationPoints = pointsFor("reservations");
  const promoPoints = pointsFor("promotion_mentions");
  const reservationArea = `${padding.left},${height - padding.bottom} ${reservationPoints} ${width - padding.right},${height - padding.bottom}`;
  const yTicks = [0, Math.ceil(maxValue / 2), maxValue];
  const activeMonth = hoveredIndex !== null ? months[hoveredIndex] : null;
  const tooltipX = hoveredIndex !== null ? xFor(hoveredIndex) : 0;
  const tooltipY = activeMonth
    ? Math.min(yFor(activeMonth.reservations || 0), yFor(activeMonth.promotion_mentions || 0))
    : 0;
  const tooltipWidth = 150;
  const tooltipHeight = 58;
  const tooltipLeft = Math.min(Math.max(tooltipX - tooltipWidth / 2, padding.left), width - padding.right - tooltipWidth);
  const tooltipTop = Math.max(tooltipY - tooltipHeight - 14, padding.top + 2);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: C.muted }}>Reservation volume by month, with promotion mentions shown as a comparison line.</div>
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <LegendDot color={C.blue} label="Reservations" />
          <LegendDot color={C.gold} label="Promotion mentions" dashed />
        </div>
      </div>

      <div style={{ width: "100%", overflowX: "auto" }}>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Monthly reservation trend line chart" style={{ width: "100%", minWidth: 560, display: "block" }}>
          <style>{`
            @keyframes reportLineDraw { from { stroke-dashoffset: 900; } to { stroke-dashoffset: 0; } }
            @keyframes reportAreaIn { from { opacity: 0; } to { opacity: 1; } }
            .report-line { stroke-dasharray: 900; stroke-dashoffset: 900; animation: reportLineDraw 0.85s ease forwards; }
            .report-promo-line { opacity: 0; animation: reportAreaIn 0.55s ease 0.22s forwards; }
            .report-area { opacity: 0; animation: reportAreaIn 0.65s ease 0.14s forwards; }
            .report-point { transition: r 0.16s ease, fill 0.16s ease, stroke-width 0.16s ease; }
          `}</style>
          <defs>
            <linearGradient id="reportsChartBg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#FFFFFF" />
              <stop offset="55%" stopColor="#FAF8F4" />
              <stop offset="100%" stopColor="#F1ECE1" />
            </linearGradient>
            <linearGradient id="reservationAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={C.blue} stopOpacity="0.18" />
              <stop offset="100%" stopColor={C.blue} stopOpacity="0.015" />
            </linearGradient>
            <filter id="chartShadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#18140E" floodOpacity="0.10" />
            </filter>
          </defs>
          <rect x="0" y="0" width={width} height={height} fill="url(#reportsChartBg)" rx="12" />

          {yTicks.map((tick) => {
            const y = yFor(tick);
            return (
              <g key={tick}>
                <line x1={padding.left} x2={width - padding.right} y1={y} y2={y} stroke="rgba(0,0,0,0.06)" />
                <text x={padding.left - 10} y={y + 4} textAnchor="end" fontSize="10" fill={C.faint}>{tick}</text>
              </g>
            );
          })}

          {months.map((month, index) => {
            const x = xFor(index);
            return (
              <text key={month.month} x={x} y={height - 12} textAnchor="middle" fontSize="10" fill={C.muted}>
                {month.label}
              </text>
            );
          })}

          <polygon className="report-area" points={reservationArea} fill="url(#reservationAreaFill)" />
          <polyline className="report-line" points={reservationPoints} fill="none" stroke={C.blue} strokeWidth="3.5" strokeLinejoin="round" strokeLinecap="round" filter="url(#chartShadow)" />
          <polyline className="report-promo-line" points={promoPoints} fill="none" stroke={C.gold} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6 6" />

          {months.map((month, index) => (
            <g key={`${month.month}-points`} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)} style={{ cursor: "default" }}>
              <rect
                x={xFor(index) - innerWidth / Math.max(months.length - 1, 1) / 2}
                y={padding.top}
                width={innerWidth / Math.max(months.length - 1, 1)}
                height={innerHeight}
                fill="transparent"
              />
              <circle className="report-point" cx={xFor(index)} cy={yFor(month.reservations || 0)} r={hoveredIndex === index ? 6 : 4} fill={hoveredIndex === index ? C.blue : C.surface} stroke={C.blue} strokeWidth={hoveredIndex === index ? 3 : 2} />
              <circle className="report-point" cx={xFor(index)} cy={yFor(month.promotion_mentions || 0)} r={hoveredIndex === index ? 5 : 3.5} fill={hoveredIndex === index ? C.gold : C.surface} stroke={C.gold} strokeWidth={hoveredIndex === index ? 3 : 2} />
            </g>
          ))}

          {activeMonth && (
            <g pointerEvents="none">
              <line x1={tooltipX} x2={tooltipX} y1={padding.top} y2={height - padding.bottom} stroke="rgba(24,20,14,0.16)" strokeDasharray="4 4" />
              <rect x={tooltipLeft} y={tooltipTop} width={tooltipWidth} height={tooltipHeight} rx="10" fill="#FFFFFF" stroke="rgba(140,107,42,0.18)" filter="url(#chartShadow)" />
              <text x={tooltipLeft + 10} y={tooltipTop + 17} fontSize="10" fontWeight="800" letterSpacing="0.08em" textTransform="uppercase" fill={C.gold}>{activeMonth.label}</text>
              <circle cx={tooltipLeft + 12} cy={tooltipTop + 33} r="3" fill={C.blue} />
              <text x={tooltipLeft + 22} y={tooltipTop + 37} fontSize="11" fill={C.muted}>{activeMonth.reservations || 0} reservations</text>
              <circle cx={tooltipLeft + 12} cy={tooltipTop + 48} r="3" fill={C.gold} />
              <text x={tooltipLeft + 22} y={tooltipTop + 52} fontSize="11" fill={C.muted}>{activeMonth.promotion_mentions || 0} promo mentions</text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}

function LegendDot({ color, label, dashed = false }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: C.muted, fontSize: 11.5 }}>
      <span style={{ width: 22, borderTop: `2px ${dashed ? "dashed" : "solid"} ${color}`, display: "inline-block" }} />
      {label}
    </span>
  );
}

function MonthlyReports({ monthlyReport }) {
  const months = monthlyReport.months || [];
  const outlets = monthlyReport.outlets || [];
  const summary = monthlyReport.summary || {};

  return (
    <div className="reports-grid" style={{ display: "grid", gridTemplateColumns: "minmax(320px,1.2fr) minmax(260px,0.8fr)", gap: 14 }}>
      <SummaryPanel title={`Monthly Trend ${monthlyReport.year || ""}`}>
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 10 }}>
            <MiniStat label="Year Total" value={summary.reservations || 0} />
            <MiniStat label="Promotions" value={summary.promotion_mentions || 0} />
            <MiniStat label="Outlets" value={summary.outlets || 0} />
            <MiniStat label="Peak Month" value={summary.peak_month || "-"} />
          </div>

          <MonthlyLineChart months={months} />
        </div>
      </SummaryPanel>

      <SummaryPanel title="Monthly Status & Outlets">
        <div style={{ display: "grid", gap: 14 }}>
          <div style={{ display: "grid", gap: 10 }}>
            <ProgressRow label="Reserved" value={summary.reserved || 0} total={summary.reservations || 0} tone="green" />
            <ProgressRow label="Pending" value={summary.pending || 0} total={summary.reservations || 0} tone="gold" />
            <ProgressRow label="Rejected" value={summary.rejected || 0} total={summary.reservations || 0} tone="red" />
            <ProgressRow label="Cancelled" value={summary.cancelled || 0} total={summary.reservations || 0} tone="slate" />
          </div>

          <div style={{ borderTop: `1px solid ${C.divider}`, paddingTop: 12, display: "grid", gap: 8 }}>
            <div style={{ fontSize: 10, color: C.faint, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 700 }}>Top outlets this year</div>
            {outlets.length === 0 ? (
              <div style={{ color: C.muted, fontSize: 12 }}>No outlet activity yet.</div>
            ) : outlets.slice(0, 5).map((outlet) => (
              <div key={outlet.outlet} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto", gap: 10, alignItems: "center", color: C.muted, fontSize: 12 }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{outlet.outlet}</span>
                <span style={{ color: C.text, fontWeight: 650 }}>{outlet.reservations}</span>
              </div>
            ))}
          </div>
        </div>
      </SummaryPanel>
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
                    boxShadow: active ? "0 8px 18px rgba(140,107,42,0.08)" : "none",
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
    const rows = report.data || [];
    const outletFiltered = selectedOutlet === "ALL"
      ? rows
      : rows.filter((row) => String(row.name) === selectedOutlet);
    const groupFiltered = selectedOutletGroup === "all"
      ? outletFiltered
      : outletFiltered.filter((row) => outletGroup(row) === selectedOutletGroup);
    return sortRows(groupFiltered, outletSort);
  }, [report.data, selectedOutlet, selectedOutletGroup, outletSort]);

  const summary = report.summary || {};
  const category = report.category_breakdown || {};
  const statuses = report.status_breakdown || {};
  const roomDetails = useMemo(() => sortRows(report.room_details || [], roomSort), [report.room_details, roomSort]);
  const allOutlets = report.data || [];
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
        @media (max-width: 980px) {
          .reports-top, .reports-grid, .reports-toolbar, .reports-nav-grid { grid-template-columns: 1fr !important; }
          .reports-filter-panel { min-width: 0 !important; }
        }
      `}</style>
      <AdminNavbar />
      <div style={{ display: "flex" }}>
        <Sidebar activeNav="reports" isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main style={{ flex: 1, height: "calc(100vh - 60px)", overflow: "auto", padding: "28px 32px" }}>
          <div className="reports-top" style={{ display: "grid", gridTemplateColumns: "minmax(260px,1fr) auto", gap: 18, alignItems: "end", marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: C.gold, marginBottom: 6 }}>Reports</div>
              <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, color: C.text, fontWeight: 650 }}>Outlet Performance</h1>
              {canViewReports && <div style={{ marginTop: 6, fontSize: 12.5, color: C.muted }}>{activeReport?.label || "Reports"} uses {filterModeLabel}.</div>}
            </div>

            {canViewReports && (
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
                            {(report.data || []).map((outlet) => <option key={outlet.name || outlet.venue_id} value={String(outlet.name)}>{outlet.name}</option>)}
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
          </div>

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
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,minmax(0,1fr))", gap: 8 }}>
                          <FilterChip icon={Layers} label="All" count={allOutlets.length} active={selectedOutletGroup === "all"} onClick={() => setSelectedOutletGroup("all")} />
                          <FilterChip icon={Building2} label="Rooms" count={roomOutletCount} active={selectedOutletGroup === "rooms"} onClick={() => setSelectedOutletGroup("rooms")} />
                          <FilterChip icon={Utensils} label="Dining" count={diningOutletCount} active={selectedOutletGroup === "dining"} onClick={() => setSelectedOutletGroup("dining")} />
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
