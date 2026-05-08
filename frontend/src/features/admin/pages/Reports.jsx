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
    : date.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
}

function StatCard({ label, value, tone = "gold" }) {
  const colors = {
    gold: [C.gold, C.goldFaint],
    green: [C.green, C.greenFaint],
    red: [C.red, C.redFaint],
    blue: [C.blue, C.blueFaint],
  };
  const [color, bg] = colors[tone] || colors.gold;

  return (
    <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:"16px 18px" }}>
      <div style={{ fontFamily:F.label,fontSize:9,fontWeight:700,letterSpacing:"0.18em",textTransform:"uppercase",color:C.faint,marginBottom:8 }}>{label}</div>
      <div style={{ display:"inline-flex",alignItems:"center",minWidth:52,justifyContent:"center",borderRadius:8,padding:"6px 10px",background:bg,color,fontSize:24,fontWeight:800,lineHeight:1 }}>{value}</div>
    </div>
  );
}

function BreakdownCard({ title, value, detail, tone = "gold" }) {
  const colors = {
    gold: [C.gold, C.goldFaint],
    green: [C.green, C.greenFaint],
    red: [C.red, C.redFaint],
    blue: [C.blue, C.blueFaint],
  };
  const [color, bg] = colors[tone] || colors.gold;

  return (
    <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:16,minWidth:0 }}>
      <div style={{ fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.16em",textTransform:"uppercase",color:C.faint,marginBottom:10 }}>{title}</div>
      <div style={{ fontSize:24,fontWeight:800,color,background:bg,borderRadius:8,display:"inline-flex",minWidth:54,justifyContent:"center",padding:"6px 10px",lineHeight:1 }}>{value}</div>
      {detail && <div style={{ marginTop:9,fontSize:12,color:C.muted }}>{detail}</div>}
    </div>
  );
}

function ReportBar({ label, value, total, color }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;

  return (
    <div style={{ display:"grid",gap:5 }}>
      <div style={{ display:"flex",justifyContent:"space-between",gap:10,fontSize:11,color:C.muted }}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div style={{ height:7,borderRadius:999,background:"rgba(0,0,0,0.05)",overflow:"hidden" }}>
        <div style={{ width:`${pct}%`,height:"100%",background:color,borderRadius:999 }} />
      </div>
    </div>
  );
}

function OutletCard({ outlet }) {
  const total = outlet.total_reservations || 0;

  return (
    <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:16,display:"grid",gap:12,minWidth:0,overflow:"hidden" }}>
      <div style={{ display:"grid",gridTemplateColumns:"minmax(0,1fr) auto",gap:12,alignItems:"start" }}>
        <div style={{ minWidth:0 }}>
          <div title={outlet.name} style={{ fontSize:15,fontWeight:800,color:C.text,marginBottom:4,lineHeight:1.25,overflowWrap:"anywhere" }}>{outlet.name}</div>
          <div style={{ fontSize:11.5,color:C.muted }}>{outlet.wing || "No wing"} - {outlet.type || "outlet"}</div>
        </div>
        <span style={{ padding:"4px 8px",borderRadius:999,background:C.goldFaint,color:C.gold,fontSize:10,fontWeight:800,whiteSpace:"nowrap",maxWidth:"100%" }}>{outlet.acceptance_rate}% accepted</span>
      </div>
      <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(92px,1fr))",gap:8 }}>
        <MiniStat label="Total" value={total} />
        <MiniStat label="Guests" value={outlet.guests || 0} />
        <MiniStat label="Active" value={outlet.active || 0} />
        <MiniStat label="Dine-In" value={outlet.dine_in || 0} />
        <MiniStat label="Promo" value={outlet.promotion_mentions || 0} />
      </div>
      <div style={{ display:"grid",gap:8 }}>
        <ReportBar label="Reserved" value={outlet.reserved || 0} total={total} color={C.green} />
        <ReportBar label="Pending" value={outlet.pending || 0} total={total} color={C.gold} />
        <ReportBar label="Rejected" value={outlet.rejected || 0} total={total} color={C.red} />
        <ReportBar label="Cancelled" value={outlet.cancelled || 0} total={total} color={C.faint} />
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ border:`1px solid ${C.divider}`,borderRadius:8,padding:"8px 9px",background:C.soft,minWidth:0 }}>
      <div style={{ fontSize:10,color:C.faint,textTransform:"uppercase",letterSpacing:"0.10em",fontWeight:800,marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:16,fontWeight:800,color:C.text }}>{value}</div>
    </div>
  );
}

export default function Reports() {
  const [sidebarOpen,setSidebarOpen] = useState(true);
  const [startDate,setStartDate] = useState(monthStart());
  const [endDate,setEndDate] = useState(today());
  const [selectedOutlet,setSelectedOutlet] = useState("ALL");
  const [report,setReport] = useState({ summary:{}, data:[] });
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState("");
  const canViewReports = authAPI.hasPermission("view_outlet_reports");

  const loadReport = async () => {
    if (!canViewReports) return;
    setLoading(true);
    setError("");

    try {
      const data = await reportAPI.getOutletReports({ start_date:startDate, end_date:endDate });
      setReport(data);
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
  const dateRangeLabel = `${readableDate(startDate)} to ${readableDate(endDate)}`;

  return (
    <div style={{ minHeight:"100vh",background:C.page,fontFamily:F.body }}>
      <AdminNavbar />
      <div style={{ display:"flex" }}>
        <Sidebar activeNav="reports" isOpen={sidebarOpen} onToggle={()=>setSidebarOpen(!sidebarOpen)} />
        <main style={{ flex:1,height:"calc(100vh - 60px)",overflow:"auto",padding:"28px 32px" }}>
          <div style={{ display:"flex",justifyContent:"space-between",alignItems:"flex-end",gap:18,marginBottom:18,flexWrap:"wrap" }}>
            <div>
              <div style={{ fontFamily:F.label,fontSize:10,fontWeight:800,letterSpacing:"0.22em",textTransform:"uppercase",color:C.gold,marginBottom:6 }}>Reports</div>
              <h1 style={{ margin:0,fontSize:32,lineHeight:1.1,color:C.text }}>Outlet Reports</h1>
              {canViewReports && <div style={{ marginTop:6,fontSize:12,color:C.muted }}>Showing reservations from {dateRangeLabel}</div>}
            </div>
            {canViewReports && (
              <div style={{ display:"flex",gap:10,alignItems:"flex-end",flexWrap:"wrap" }}>
                <FilterField label="Start date">
                  <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} style={filterStyle()} />
                </FilterField>
                <FilterField label="End date">
                  <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} style={filterStyle()} />
                </FilterField>
                <FilterField label="Outlet">
                  <select value={selectedOutlet} onChange={(e)=>setSelectedOutlet(e.target.value)} style={{ ...filterStyle(), minWidth:190 }}>
                    <option value="ALL">All outlets</option>
                    {(report.data || []).map((outlet) => <option key={outlet.venue_id || outlet.name} value={String(outlet.venue_id || outlet.name)}>{outlet.name}</option>)}
                  </select>
                </FilterField>
                <button onClick={loadReport} disabled={loading} style={{ height:38,padding:"0 14px",border:"none",borderRadius:8,background:C.gold,color:"#fff",fontFamily:F.label,fontSize:10,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",cursor:loading?"not-allowed":"pointer" }}>
                  {loading ? "Loading" : "Apply"}
                </button>
              </div>
            )}
          </div>

          {!canViewReports ? (
            <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:22,color:C.muted }}>
              Your account can access admin pages, but does not have report visibility.
            </div>
          ) : error ? (
            <div style={{ background:C.redFaint,border:"1px solid rgba(160,56,56,0.18)",borderRadius:10,padding:14,color:C.red }}>{error}</div>
          ) : (
            <>
              <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(150px,1fr))",gap:12,marginBottom:18 }}>
                <StatCard label="Outlets" value={summary.outlets || 0} />
                <StatCard label="Reservations" value={summary.reservations || 0} tone="blue" />
                <StatCard label="Guests" value={summary.guests || 0} tone="green" />
                <StatCard label="Dine-In" value={summary.dine_in || 0} tone="green" />
                <StatCard label="Promo Mentions" value={summary.promotion_mentions || 0} tone="blue" />
                <StatCard label="Pending" value={summary.pending || 0} />
                <StatCard label="Rejected" value={summary.rejected || 0} tone="red" />
              </div>

              {loading ? (
                <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:28,color:C.muted }}>Loading outlet report...</div>
              ) : (
                <>
                  <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginBottom:18 }}>
                    <BreakdownCard title="Dine-In Reservations" value={category.dine_in?.reservations || 0} detail={`${category.dine_in?.guests || 0} guests from dining outlets`} tone="green" />
                    <BreakdownCard title="Room Reservations" value={category.room_reservations?.reservations || 0} detail={`${category.room_reservations?.guests || 0} guests from function rooms`} tone="gold" />
                    <BreakdownCard title="Promotion Mentions" value={category.promotion_mentions?.reservations || 0} detail={`${category.promotion_mentions?.guests || 0} guests with promo-related notes`} tone="blue" />
                  </div>

                  <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,padding:16,marginBottom:18 }}>
                    <div style={{ fontFamily:F.label,fontSize:10,fontWeight:800,letterSpacing:"0.16em",textTransform:"uppercase",color:C.gold,marginBottom:12 }}>Reservation Statuses</div>
                    <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:12 }}>
                      <ReportBar label="Pending" value={statuses.pending || 0} total={summary.reservations || 0} color={C.gold} />
                      <ReportBar label="Reserved" value={(statuses.reserved || 0) + (statuses.approved || 0)} total={summary.reservations || 0} color={C.green} />
                      <ReportBar label="Rejected" value={statuses.rejected || 0} total={summary.reservations || 0} color={C.red} />
                      <ReportBar label="Cancelled" value={statuses.cancelled || 0} total={summary.reservations || 0} color={C.faint} />
                    </div>
                  </div>

                  <div style={{ display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%, 340px),1fr))",gap:12,marginBottom:18 }}>
                    {filteredOutlets.map((outlet) => <OutletCard key={outlet.venue_id || outlet.name} outlet={outlet} />)}
                  </div>

                  <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden",marginBottom:18 }}>
                    <div style={{ padding:"14px 18px",borderBottom:`1px solid ${C.divider}`,fontFamily:F.label,fontSize:10,fontWeight:800,letterSpacing:"0.16em",textTransform:"uppercase",color:C.gold }}>Room Reservation Details</div>
                    <div style={{ overflowX:"auto" }}>
                      <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12.5 }}>
                        <thead>
                          <tr style={{ background:C.soft,color:C.faint,textTransform:"uppercase",letterSpacing:"0.10em",fontSize:10 }}>
                            {["Room / Outlet","Reservations","Guests","Pending","Reserved","Rejected","Cancelled","Dine-In","Promo","Latest Event"].map((header) => (
                              <th key={header} style={{ textAlign:"left",padding:"10px 12px",borderBottom:`1px solid ${C.divider}` }}>{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {roomDetails.map((room) => (
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
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ background:C.surface,border:`1px solid ${C.border}`,borderRadius:10,overflow:"hidden" }}>
                    <div style={{ padding:"14px 18px",borderBottom:`1px solid ${C.divider}`,fontFamily:F.label,fontSize:10,fontWeight:800,letterSpacing:"0.16em",textTransform:"uppercase",color:C.gold }}>Outlet Detail</div>
                    <div style={{ overflowX:"auto" }}>
                      <table style={{ width:"100%",borderCollapse:"collapse",fontSize:12.5 }}>
                        <thead>
                          <tr style={{ background:C.soft,color:C.faint,textTransform:"uppercase",letterSpacing:"0.10em",fontSize:10 }}>
                            {["Outlet","Wing","Total","Guests","Dine-In","Promo","Reserved","Pending","Rejected","Cancelled","Active","Latest Event"].map((header) => (
                              <th key={header} style={{ textAlign:"left",padding:"10px 12px",borderBottom:`1px solid ${C.divider}` }}>{header}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOutlets.map((outlet) => (
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
                              <td style={cellStyle()}>{outlet.active}</td>
                              <td style={cellStyle()}>{outlet.latest_event_date || "-"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

function FilterField({ label, children }) {
  return (
    <label style={{ display:"grid",gap:5 }}>
      <span style={{ fontFamily:F.label,fontSize:9,fontWeight:800,letterSpacing:"0.14em",textTransform:"uppercase",color:C.faint }}>{label}</span>
      {children}
    </label>
  );
}

function filterStyle() {
  return {
    height:38,
    border:`1px solid ${C.border}`,
    borderRadius:8,
    background:C.surface,
    color:C.text,
    padding:"0 10px",
    fontFamily:F.body,
    fontSize:12,
    outline:"none",
  };
}

function cellStyle(strong = false) {
  return {
    padding:"11px 12px",
    borderBottom:`1px solid ${C.divider}`,
    color:strong ? C.text : C.muted,
    fontWeight:strong ? 800 : 500,
    whiteSpace:"nowrap",
  };
}
