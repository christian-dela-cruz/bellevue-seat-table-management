import { useEffect, useMemo, useState } from "react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import Sidebar from "../../../components/layout/Sidebar";
import { authAPI } from "../../../services/authAPI";
import { reportAPI } from "../../../services/reportAPI";

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
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "15px 16px", minWidth: 0 }}>
      <div style={{ fontFamily: F.label, fontSize: 9, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.faint, marginBottom: 10 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ color, background: bg, borderRadius: 8, padding: "5px 10px", minWidth: 48, textAlign: "center", fontSize: 22, fontWeight: 650, lineHeight: 1 }}>{value}</span>
        {detail && <span style={{ color: C.muted, fontSize: 12 }}>{detail}</span>}
      </div>
    </div>
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

function SummaryPanel({ title, children }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 16, minWidth: 0 }}>
      <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold, marginBottom: 14 }}>{title}</div>
      {children}
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
        <span style={{ padding: "4px 8px", borderRadius: 999, background: C.goldFaint, color: C.gold, fontSize: 10, fontWeight: 700, whiteSpace: "nowrap" }}>{outlet.acceptance_rate}% accepted</span>
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

function TransactionMonitor({ transactionReport, isGlobal }) {
  const summary = transactionReport.summary || {};
  const rows = transactionReport.data || [];

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
                        <StatusPill value={row.from_status} />
                        <span style={{ color: C.faint }}>to</span>
                        <StatusPill value={row.to_status} />
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
          <rect x="0" y="0" width={width} height={height} fill={C.soft} rx="10" />

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

          <polyline points={reservationPoints} fill="none" stroke={C.blue} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
          <polyline points={promoPoints} fill="none" stroke={C.gold} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="6 6" />

          {months.map((month, index) => (
            <g key={`${month.month}-points`} onMouseEnter={() => setHoveredIndex(index)} onMouseLeave={() => setHoveredIndex(null)} style={{ cursor: "default" }}>
              <rect
                x={xFor(index) - innerWidth / Math.max(months.length - 1, 1) / 2}
                y={padding.top}
                width={innerWidth / Math.max(months.length - 1, 1)}
                height={innerHeight}
                fill="transparent"
              />
              <circle cx={xFor(index)} cy={yFor(month.reservations || 0)} r="4" fill={C.surface} stroke={C.blue} strokeWidth="2" />
              <circle cx={xFor(index)} cy={yFor(month.promotion_mentions || 0)} r="3.5" fill={C.surface} stroke={C.gold} strokeWidth="2" />
            </g>
          ))}

          {activeMonth && (
            <g pointerEvents="none">
              <line x1={tooltipX} x2={tooltipX} y1={padding.top} y2={height - padding.bottom} stroke="rgba(24,20,14,0.16)" strokeDasharray="4 4" />
              <rect x={tooltipLeft} y={tooltipTop} width={tooltipWidth} height={tooltipHeight} rx="8" fill="#FFFFFF" stroke="rgba(0,0,0,0.12)" />
              <text x={tooltipLeft + 10} y={tooltipTop + 17} fontSize="11" fontWeight="700" fill={C.text}>{activeMonth.label}</text>
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
    <div style={{ display: "grid", gridTemplateColumns: "minmax(320px,1.2fr) minmax(260px,0.8fr)", gap: 14 }}>
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

function TableCard({ title, headers, rows, renderRow }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, overflow: "hidden", minWidth: 0 }}>
      <div style={{ padding: "14px 16px", borderBottom: `1px solid ${C.divider}`, fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: C.gold }}>{title}</div>
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
    </div>
  );
}

function ReportTabs({ tabs, activeTab, onChange }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 6, display: "flex", gap: 4, overflowX: "auto" }}>
      {tabs.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              border: "none",
              borderRadius: 8,
              background: active ? C.goldFaint : "transparent",
              color: active ? C.gold : C.muted,
              padding: "10px 12px",
              fontFamily: F.label,
              fontSize: 11,
              fontWeight: active ? 700 : 500,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export default function Reports() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState("summary");
  const [startDate, setStartDate] = useState(monthStart());
  const [endDate, setEndDate] = useState(today());
  const [selectedOutlet, setSelectedOutlet] = useState("ALL");
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
      const reportYear = Number(startDate?.slice(0, 4)) || new Date().getFullYear();
      const [outletData, transactionData, monthlyData] = await Promise.all([
        reportAPI.getOutletReports({ start_date: startDate, end_date: endDate }),
        canViewTransactions
          ? reportAPI.getTransactionReports({ start_date: startDate, end_date: endDate })
          : Promise.resolve(null),
        reportAPI.getMonthlyReports({ year: reportYear }),
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
    return selectedOutlet === "ALL" ? rows : rows.filter((row) => String(row.venue_id || row.name) === selectedOutlet);
  }, [report.data, selectedOutlet]);

  const summary = report.summary || {};
  const category = report.category_breakdown || {};
  const statuses = report.status_breakdown || {};
  const roomDetails = report.room_details || [];
  const transactionSummary = transactionReport.summary || {};
  const dateRangeLabel = `${readableDate(startDate)} to ${readableDate(endDate)}`;
  const reservedCount = (statuses.reserved || 0) + (statuses.approved || 0);
  const totalReservations = summary.reservations || 0;
  const tabs = [
    { id: "summary", label: "Summary" },
    { id: "monthly", label: "Monthly" },
    { id: "outlets", label: "Outlets" },
    ...(canViewTransactions ? [{ id: "audit", label: "Audit Trail" }] : []),
    { id: "details", label: "Details" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.page, fontFamily: F.body }}>
      <AdminNavbar />
      <div style={{ display: "flex" }}>
        <Sidebar activeNav="reports" isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main style={{ flex: 1, height: "calc(100vh - 60px)", overflow: "auto", padding: "28px 32px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,1fr) auto", gap: 18, alignItems: "end", marginBottom: 18 }}>
            <div>
              <div style={{ fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.22em", textTransform: "uppercase", color: C.gold, marginBottom: 6 }}>Reports</div>
              <h1 style={{ margin: 0, fontSize: 32, lineHeight: 1.1, color: C.text, fontWeight: 650 }}>Outlet Performance</h1>
              {canViewReports && <div style={{ marginTop: 6, fontSize: 12.5, color: C.muted }}>Reservations and transaction activity from {dateRangeLabel}</div>}
            </div>

            {canViewReports && (
              <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: 12, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap", justifyContent: "flex-end" }}>
                <FilterField label="Start">
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={filterStyle()} />
                </FilterField>
                <FilterField label="End">
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} style={filterStyle()} />
                </FilterField>
                <FilterField label="Outlet">
                  <select value={selectedOutlet} onChange={(e) => setSelectedOutlet(e.target.value)} style={{ ...filterStyle(), minWidth: 190 }}>
                    <option value="ALL">All outlets</option>
                    {(report.data || []).map((outlet) => <option key={outlet.venue_id || outlet.name} value={String(outlet.venue_id || outlet.name)}>{outlet.name}</option>)}
                  </select>
                </FilterField>
                <button onClick={loadReport} disabled={loading} style={{ height: 38, padding: "0 14px", border: "none", borderRadius: 8, background: C.gold, color: "#fff", fontFamily: F.label, fontSize: 10, fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", cursor: loading ? "not-allowed" : "pointer" }}>
                  {loading ? "Loading" : "Apply"}
                </button>
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
              <ReportTabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

              {activeTab === "summary" && (
                <>
                  <Section title="Overview" subtitle="High-level activity for the selected date range.">
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", gap: 12 }}>
                      <MetricCard label="Reservations" value={summary.reservations || 0} tone="blue" />
                      <MetricCard label="Guests" value={summary.guests || 0} tone="green" />
                      <MetricCard label="Outlets" value={summary.outlets || 0} tone="gold" />
                      <MetricCard label="Transactions" value={transactionSummary.transactions || 0} detail={canViewTransactions ? "read-only" : ""} tone="slate" />
                    </div>
                  </Section>

                  <div style={{ display: "grid", gridTemplateColumns: "minmax(280px,1.05fr) minmax(280px,0.95fr)", gap: 14 }}>
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
                <Section title="Monthly Reporting" subtitle="Year-to-date monthly view covering reservation volume, promotions, outlet activity, and statuses.">
                  <MonthlyReports monthlyReport={monthlyReport} />
                </Section>
              )}

              {activeTab === "outlets" && (
                <Section title="Outlet Performance" subtitle="Cards are sorted by reservation volume. Use the outlet filter above to narrow the list.">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%, 320px),1fr))", gap: 12 }}>
                    {filteredOutlets.map((outlet) => <OutletCard key={outlet.venue_id || outlet.name} outlet={outlet} />)}
                  </div>
                </Section>
              )}

              {activeTab === "audit" && canViewTransactions && (
                <Section title="Audit Trail" subtitle="Read-only status changes for operational review.">
                  <TransactionMonitor transactionReport={transactionReport} isGlobal={canViewGlobalReports} />
                </Section>
              )}

              {activeTab === "details" && (
                <Section title="Detailed Records" subtitle="Use these tables when you need exact room or outlet totals.">
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%, 520px),1fr))", gap: 14 }}>
                    <TableCard
                      title="Room Reservation Details"
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

                    <TableCard
                      title="Outlet Detail"
                      headers={["Outlet", "Wing", "Total", "Guests", "Dine-In", "Promo", "Reserved", "Pending", "Rejected", "Cancelled", "Latest Event"]}
                      rows={filteredOutlets}
                      renderRow={(outlet) => (
                        <tr key={outlet.venue_id || outlet.name}>
                          <td style={cellStyle(true)}>{outlet.name}</td>
                          <td style={cellStyle()}>{outlet.wing || "-"}</td>
                          <td style={cellStyle()}>{outlet.total_reservations}</td>
                          <td style={cellStyle()}>{outlet.guests}</td>
                          <td style={cellStyle()}>{outlet.dine_in}</td>
                          <td style={cellStyle()}>{outlet.promotion_mentions}</td>
                          <td style={cellStyle()}>{outlet.reserved}</td>
                          <td style={cellStyle()}>{outlet.pending}</td>
                          <td style={cellStyle()}>{outlet.rejected}</td>
                          <td style={cellStyle()}>{outlet.cancelled}</td>
                          <td style={cellStyle()}>{outlet.latest_event_date || "-"}</td>
                        </tr>
                      )}
                    />
                  </div>
                </Section>
              )}
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
    fontWeight: 700,
    whiteSpace: "nowrap",
  };
}

function cellStyle(strong = false) {
  return {
    padding: "11px 12px",
    borderBottom: `1px solid ${C.divider}`,
    color: strong ? C.text : C.muted,
    fontWeight: strong ? 650 : 450,
    whiteSpace: "nowrap",
  };
}
