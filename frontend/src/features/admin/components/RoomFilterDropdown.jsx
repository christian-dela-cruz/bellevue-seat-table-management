import { useMemo, useState, useEffect, useRef } from "react";
import { Search, ChevronDown } from "lucide-react";
import { buildDynamicOutletTree, canonicalOutletName } from "../../../constants/outletCatalog";

const C = {
  pageBg: "#F7F4EE",
  surface: "#FFFFFF",
  surfaceBase: "#FFFFFF",
  soft: "#FAF8F4",
  borderDefault: "rgba(0,0,0,0.08)",
  borderAccent: "rgba(140,107,42,0.28)",
  border: "rgba(0,0,0,0.08)",
  divider: "rgba(0,0,0,0.05)",
  gold: "#8C6B2A",
  goldFaint: "rgba(140,107,42,0.08)",
  text: "#18140E",
  textPrimary: "#18140E",
  textSecondary: "#7A7060",
  textTertiary: "rgba(24,20,14,0.35)",
  faint: "rgba(24,20,14,0.42)",
  inputFocusShadow: "0 0 0 3px rgba(140,107,42,0.10)",
};

const F = {
  body: "'Inter','Helvetica Neue',Arial,sans-serif",
  label: "'Inter','Helvetica Neue',Arial,sans-serif",
};

export default function RoomFilterDropdown({ rooms = [], venues = [], selectedRoom, onSelect, isMobile }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const label = selectedRoom === "ALL" ? "All Rooms" : selectedRoom;
  const hasFilter = selectedRoom !== "ALL";
  const normalizedQuery = query.trim().toLowerCase();

  const dynamicTree = useMemo(() => buildDynamicOutletTree(venues), [venues]);

  const availableRooms = useMemo(() => new Set(rooms.map(canonicalOutletName)), [rooms]);
  const isAvailable = (name) => {
    if (rooms.length === 0) return true;
    return availableRooms.has(canonicalOutletName(name));
  };
  
  const fallbackRooms = rooms.filter((room) => !dynamicTree.some((group) =>
    group.sections.some((section) => section.label === room || section.items.includes(room))
  ));

  const matches = (name) => !normalizedQuery || String(name).toLowerCase().includes(normalizedQuery);

  const selectRoom = (name) => {
    onSelect(name);
    setOpen(false);
    setQuery("");
  };

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0, minWidth: 0, width: "100%" }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={{
          display: "flex",
          width: "100%",
          alignItems: "center",
          gap: 6,
          padding: "7px 11px",
          background: hasFilter ? C.goldFaint : C.surfaceBase,
          border: `1.5px solid ${open || focused ? C.borderAccent : hasFilter ? C.gold + "55" : C.borderDefault}`,
          borderRadius: 8,
          fontFamily: F.label,
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.10em",
          textTransform: "uppercase",
          color: hasFilter ? C.gold : C.textSecondary,
          cursor: "pointer",
          transition: "all 0.18s",
          whiteSpace: "nowrap",
          boxShadow: open ? C.inputFocusShadow : "none",
          minWidth: isMobile ? 120 : 148,
          height: 38,
        }}
        onMouseEnter={(e) => {
          if (!open) {
            e.currentTarget.style.borderColor = C.borderAccent;
            e.currentTarget.style.color = C.gold;
          }
        }}
        onMouseLeave={(e) => {
          if (!open && !focused) {
            e.currentTarget.style.borderColor = hasFilter ? C.gold + "55" : C.borderDefault;
            e.currentTarget.style.color = hasFilter ? C.gold : C.textSecondary;
          }
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{flexShrink:0}}>
          <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <span style={{ flex: 1, minWidth: 0, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis" }}>
          {label}
        </span>
        <ChevronDown size={14} style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.18s", flexShrink:0 }} />
      </button>

      {open && (
         <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 1000, background: C.surfaceBase, border: `1px solid ${C.borderDefault}`, borderRadius: 12, boxShadow: "0 8px 18px rgba(40,32,18,0.08)", overflow: "hidden", minWidth: 260, width: "max-content", maxWidth: 320 }}>
          <div style={{ padding: 10, borderBottom: `1px solid ${C.divider}` }}>
            <div style={{ height: 36, border: `1px solid ${C.borderDefault}`, borderRadius: 9, background: C.soft, display: "flex", alignItems: "center", gap: 8, padding: "0 10px" }}>
              <Search size={14} color={C.faint} />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search outlet or sub-room" style={{ flex: 1, minWidth: 0, border: "none", outline: "none", background: "transparent", fontSize: 12, color: C.textPrimary }} autoFocus />
            </div>
          </div>
          <div style={{ maxHeight: 360, overflowY: "auto", padding: "8px 8px 10px", display: "grid", gap: 8 }}>
            
            {(!normalizedQuery || "all rooms".includes(normalizedQuery)) && (
              <button
                type="button"
                onClick={() => selectRoom("ALL")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "8px 14px",
                  background: selectedRoom === "ALL" ? C.goldFaint : "transparent",
                  border: "none",
                  borderRadius: 8,
                  textAlign: "left",
                  fontFamily: F.label,
                  fontSize: 10,
                  fontWeight: selectedRoom === "ALL" ? 800 : 700,
                  letterSpacing: "0.10em",
                  textTransform: "uppercase",
                  color: selectedRoom === "ALL" ? C.gold : C.textSecondary,
                  cursor: "pointer",
                  transition: "background 0.12s",
                }}
                onMouseEnter={(e) => { if (selectedRoom !== "ALL") e.currentTarget.style.background = "rgba(0,0,0,0.03)"; }}
                onMouseLeave={(e) => { if (selectedRoom !== "ALL") e.currentTarget.style.background = "transparent"; }}
              >
                {selectedRoom === "ALL" ? (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.gold} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12"/>
                  </svg>
                ) : (
                  <span style={{ width: 12 }} />
                )}
                All Rooms
              </button>
            )}

            {dynamicTree.map((group) => {
              const visibleSections = group.sections.map((section) => {
                const parentAvailable = isAvailable(section.label);
                const visibleItems = section.items.filter((name) => isAvailable(name) && matches(name));
                const showParent = parentAvailable && matches(section.label);
                return { ...section, parentAvailable, visibleItems, showParent };
              }).filter((section) => section.showParent || section.visibleItems.length);
              
              if (!visibleSections.length) return null;
              
              return (
                <div key={group.id} style={{ border: `1px solid ${C.divider}`, borderRadius: 10, overflow: "hidden", background: C.soft }}>
                  <button
                    type="button"
                    onClick={() => selectRoom(group.label)}
                    style={{
                      width: "100%",
                      border: "none",
                      padding: "8px 10px",
                      fontFamily: F.label,
                      fontSize: 9,
                      fontWeight: 850,
                      letterSpacing: "0.16em",
                      textTransform: "uppercase",
                      color: C.gold,
                      background: "rgba(140,107,42,0.045)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      cursor: "pointer",
                      textAlign: "left",
                      transition: "background 0.16s, color 0.16s",
                    }}
                    onMouseEnter={(event) => {
                      event.currentTarget.style.background = "rgba(140,107,42,0.09)";
                      event.currentTarget.style.color = C.textPrimary;
                    }}
                    onMouseLeave={(event) => {
                      event.currentTarget.style.background = "rgba(140,107,42,0.045)";
                      event.currentTarget.style.color = C.gold;
                    }}
                  >
                    <span>{group.label}</span>
                    <span style={{ fontSize: 8, opacity: 0.85, fontWeight: 700 }}>Select entire wing ➔</span>
                  </button>
                  <div style={{ display: "grid", background: C.surfaceBase }}>
                    {visibleSections.map((section) => (
                      <div key={section.label} style={{ borderTop: `1px solid ${C.divider}` }}>
                        {section.showParent && (
                          <OutletOption
                            name={section.label}
                            displayName={section.label}
                            active={selectedRoom === section.label}
                            onClick={() => selectRoom(section.label)}
                            depth={0}
                            badge={section.items.length > 1 ? "View all" : "Outlet"}
                          />
                        )}
                        {!section.showParent && section.visibleItems.length > 0 && (
                          <div style={{ padding: "8px 10px 4px", fontSize: 11, fontWeight: 750, color: C.textPrimary }}>{section.label}</div>
                        )}
                        {section.visibleItems.filter((name) => name !== section.label).map((name) => (
                          <OutletOption
                            key={name}
                            name={name}
                            displayName={name}
                            active={selectedRoom === name}
                            onClick={() => selectRoom(name)}
                            depth={section.items.length > 1 || section.label !== name ? 1 : 0}
                            badge="Sub-room"
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            
            {fallbackRooms.filter((name) => matches(name)).length > 0 && (
              <div style={{ border: `1px solid ${C.divider}`, borderRadius: 10, overflow: "hidden", background: C.surfaceBase }}>
                <div style={{ padding: "8px 10px", fontFamily: F.label, fontSize: 9, fontWeight: 850, letterSpacing: "0.16em", textTransform: "uppercase", color: C.gold, background: C.soft }}>Other Outlets</div>
                {fallbackRooms.filter((name) => matches(name)).map((name) => (
                  <OutletOption key={name} name={name} displayName={name} active={selectedRoom === name} onClick={() => selectRoom(name)} depth={0} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function OutletOption({ name, active, onClick, depth, badge, displayName }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        minHeight: 34,
        border: "none",
        background: active ? C.goldFaint : "transparent",
        color: active ? C.gold : C.textPrimary,
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
      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 12, fontWeight: active ? 750 : 500 }}>{displayName || name}</span>
      {badge && <span style={{ fontSize: 9, color: active ? C.gold : C.textTertiary, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase" }}>{badge}</span>}
    </button>
  );
}
