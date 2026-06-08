import React, { useState, useEffect } from "react";
import { Monitor, Grid, EyeOff, Save, Wand2 } from "lucide-react";
import AdminNavbar from "../../../components/layout/AdminNavbar";
import { AdminPageHeader } from "../../../components/layout/AdminPage";
import Sidebar from "../../../components/layout/Sidebar";
import { venueAPI } from "../../../services/venueAPI";
import clientDisplayAPI from "../../../services/clientDisplayAPI";
import { buildDiningOutletsFromConfig, buildEventVenuesFromConfig, VenueCard } from "../../client/pages/ReservationLanding";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  rectSortingStrategy
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const F = { body: "'Inter', sans-serif" };
const C = { surfaceSoft: "#f8f9fa", inkSoft: "#495057", gold: "#d4af37", dangerSoft: "#f8d7da" };

function SortableVenueCard({ id, item, variant, isHidden, onToggleHide }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    position: "relative",
    opacity: isHidden ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <div style={{ pointerEvents: "none" }}>
        <VenueCard item={item} variant={variant} isInteractive={false} />
      </div>
      <button 
        onClick={(e) => { e.stopPropagation(); onToggleHide(id); }}
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

export default function ClientDisplaySettings() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [section, setSection] = useState("dining");
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    dining: { desktop_columns: 6, tablet_columns: 2, mobile_columns: 1, ordered_ids: [], hidden_ids: [] },
    events: { desktop_columns: 3, tablet_columns: 2, mobile_columns: 1, ordered_ids: [], hidden_ids: [] }
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [venuesRes, settingsRes] = await Promise.all([
        venueAPI.getAll(),
        clientDisplayAPI.getAll()
      ]);
      setVenues(Array.isArray(venuesRes) ? venuesRes : []);

      const newSettings = {
        dining: { desktop_columns: 6, tablet_columns: 2, mobile_columns: 1, ordered_ids: [], hidden_ids: [] },
        events: { desktop_columns: 3, tablet_columns: 2, mobile_columns: 1, ordered_ids: [], hidden_ids: [] }
      };

      if (Array.isArray(settingsRes)) {
        settingsRes.forEach(s => {
          if (newSettings[s.section]) {
            newSettings[s.section] = { ...newSettings[s.section], ...s };
          }
        });
      }
      setSettings(newSettings);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await clientDisplayAPI.updateSection(section, settings[section]);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const currentSettings = settings[section];

  const allParsedVenues = section === "dining" ? buildDiningOutletsFromConfig(venues) : buildEventVenuesFromConfig(venues);

  const orderedVenues = [...allParsedVenues].sort((a, b) => {
    const idxA = currentSettings.ordered_ids?.indexOf(a.title) ?? -1;
    const idxB = currentSettings.ordered_ids?.indexOf(b.title) ?? -1;
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active && over && active.id !== over.id) {
      const oldIndex = orderedVenues.findIndex(v => v.title === active.id);
      const newIndex = orderedVenues.findIndex(v => v.title === over.id);
      const newArray = arrayMove(orderedVenues, oldIndex, newIndex);
      updateSetting('ordered_ids', newArray.map(v => v.title));
    }
  };

  const updateSetting = (key, value) => {
    setSettings(prev => ({
      ...prev,
      [section]: { ...prev[section], [key]: value }
    }));
  };

  const toggleHide = (title) => {
    const hidden = currentSettings.hidden_ids || [];
    if (hidden.includes(title)) {
      updateSetting('hidden_ids', hidden.filter(h => h !== title));
    } else {
      updateSetting('hidden_ids', [...hidden, title]);
    }
  };

  const handleAutoResize = () => {
    const hidden = currentSettings.hidden_ids || [];
    const visibleCount = orderedVenues.filter(v => !hidden.includes(v.title)).length;
    let opt = visibleCount;
    if (section === "dining") {
        if (opt > 6) opt = Math.ceil(opt / 2);
    } else {
        if (opt > 4) opt = Math.ceil(opt / 2);
    }
    if (opt < 1) opt = 1;
    updateSetting('desktop_columns', opt);
  };

  return (
    <div style={{ minHeight:"100vh", background: C.surfaceSoft, fontFamily: F.body }}>
      <AdminNavbar />
      <div style={{ display:"flex", height:"calc(100vh - 60px)", minHeight:0, overflow:"hidden" }}>
        <Sidebar activeNav="client-display" isOpen={sidebarOpen} onToggle={()=>setSidebarOpen(!sidebarOpen)} />
        <main style={{ flex:1, padding:"30px 32px 42px", overflow:"auto", height:"calc(100vh - 60px)" }}>
          <div style={{ maxWidth: 1400, margin: "0 auto" }}>
            <AdminPageHeader
              eyebrow="VENUE OPERATIONS"
              title="Client Page Display"
              description="Configure layout, columns, and visibility for the public reservation portal."
              C={C}
              F={F}
              actions={(
                <button
                  onClick={handleSave}
                  disabled={saving}
                  style={{
                    display: "flex", alignItems: "center", gap: 8,
                    background: "#000", color: "#fff",
                    border: 0, padding: "10px 18px", borderRadius: 8,
                    fontSize: 14, fontWeight: 500, cursor: saving ? "wait" : "pointer",
                    opacity: saving ? 0.7 : 1
                  }}
                >
                  <Save size={18} />
                  {saving ? "Saving..." : "Save Settings"}
                </button>
              )}
            />

            <div style={{ display: "flex", gap: 8, marginBottom: 32, borderBottom: "1px solid #e5e7eb", paddingBottom: 16 }}>
              <button
                onClick={() => setSection("dining")}
                style={{
                  padding: "10px 20px",
                  background: section === "dining" ? "#fff" : "transparent",
                  border: "1px solid",
                  borderColor: section === "dining" ? "#c4a35a" : "transparent",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: section === "dining" ? "#c4a35a" : C.inkSoft,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Dining Outlets
              </button>
              <button
                onClick={() => setSection("events")}
                style={{
                  padding: "10px 20px",
                  background: section === "events" ? "#fff" : "transparent",
                  border: "1px solid",
                  borderColor: section === "events" ? "#c4a35a" : "transparent",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  color: section === "events" ? "#c4a35a" : C.inkSoft,
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
              >
                Event Venues
              </button>
            </div>

            {loading ? (
              <div style={{ padding: 40, textAlign: "center", color: C.inkSoft }}>Loading...</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 32 }}>
                
                {/* Configuration Sidebar */}
                <div style={{ background: "#fff", padding: 24, borderRadius: 12, border: "1px solid #e5e7eb", alignSelf: "start" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
                    <Grid size={18} color="#c4a35a" />
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Grid Configuration</h3>
                  </div>

                  <div style={{ marginBottom: 24 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: C.inkSoft }}>Desktop Columns</label>
                      <span style={{ fontSize: 12, color: "#6b7280" }}>{currentSettings.desktop_columns} Columns</span>
                    </div>
                    <input
                      type="range"
                      min="1" max="6"
                      value={currentSettings.desktop_columns}
                      onChange={(e) => updateSetting('desktop_columns', parseInt(e.target.value))}
                      style={{ width: "100%", accentColor: "#c4a35a" }}
                    />
                  </div>

                  <button 
                    onClick={handleAutoResize}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      width: "100%", padding: "10px", borderRadius: 8,
                      background: "rgba(196, 163, 90, 0.1)", color: "#c4a35a",
                      border: "1px solid rgba(196, 163, 90, 0.2)",
                      fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    <Wand2 size={16} /> Auto Resize Grid
                  </button>
                  <p style={{ fontSize: 12, color: "#6b7280", marginTop: 8, lineHeight: 1.4 }}>
                    Click to automatically set the ideal number of columns based on how many venues are visible.
                  </p>
                </div>

                {/* Live Preview Area */}
                <div style={{ background: "#fff", padding: "32px 40px", borderRadius: 12, border: "1px solid #e5e7eb" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
                    <Monitor size={18} color="#6b7280" />
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: "#374151" }}>Visual Live Preview</h3>
                  </div>

                  <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={orderedVenues.map(v => v.title)} strategy={rectSortingStrategy}>
                      <div 
                        className={`reservation-grid reservation-grid--${section}`}
                        style={{
                          display: "grid",
                          gap: "clamp(14px, 1.25vw, 24px)",
                          gridTemplateColumns: `repeat(${currentSettings.desktop_columns}, minmax(0, 1fr))`,
                          background: "#fffaf1",
                          padding: 40,
                          borderRadius: 16,
                          border: "1px solid rgba(0,0,0,0.05)",
                          boxShadow: "inset 0 2px 20px rgba(0,0,0,0.02)"
                        }}
                      >
                        {orderedVenues.map((v, index) => (
                          <SortableVenueCard 
                            key={v.title}
                            id={v.title}
                            item={v}
                            variant={section}
                            isHidden={(currentSettings.hidden_ids || []).includes(v.title)}
                            onToggleHide={toggleHide}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>

                  <p style={{ fontSize: 13, color: "#6b7280", marginTop: 24, textAlign: "center" }}>
                    Drag and drop the cards above to reorder them. Click "Hide" to toggle visibility.
                  </p>
                </div>

              </div>
            )}
          </div>
        </main>
      </div>
      
      {/* Inject exact CSS from ReservationLanding so cards render perfectly without affecting the real site */}
      <style dangerouslySetInnerHTML={{__html: `
        .reservation-card {
          position: relative;
          overflow: hidden;
          display: block;
          width: 100%;
          min-width: 0;
          border: 0;
          border-radius: 12px;
          padding: 0;
          background: #17130e;
          text-align: left;
          box-shadow: 0 16px 34px rgba(23, 19, 14, 0.16), inset 0 0 0 1px rgba(255, 250, 241, 0.035);
        }
        .reservation-card--dining {
          aspect-ratio: 4 / 3;
          min-height: 0;
          max-height: none;
          background:
            radial-gradient(circle at 52% 34%, rgba(196, 163, 90, 0.12), transparent 56%),
            linear-gradient(180deg, rgba(255, 250, 241, 0.06), rgba(255, 250, 241, 0.015)),
            rgba(18, 16, 14, 0.96);
          border: 1px solid rgba(255, 250, 241, 0.12);
          box-shadow: 0 18px 40px rgba(10, 8, 6, 0.22), inset 0 0 0 1px rgba(196, 163, 90, 0.055);
        }
        .reservation-card--event {
          min-height: 0;
          aspect-ratio: 4 / 3; 
        }
        .reservation-card__image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          filter: saturate(1.02) contrast(1.015) brightness(0.99);
        }
        .reservation-card__shade {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.7)),
            radial-gradient(circle at 24% 18%, rgba(255, 232, 182, 0.13), transparent 36%),
            linear-gradient(90deg, rgba(0,0,0,0.36), transparent 68%);
        }
        .reservation-card__brand-surface {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(255, 250, 241, 0.035), transparent 42%),
            radial-gradient(circle at 50% 50%, rgba(255, 250, 241, 0.055), transparent 56%),
            linear-gradient(0deg, rgba(0, 0, 0, 0.13), transparent 38%);
          opacity: 0.42;
        }
        .reservation-card__brand {
          position: absolute;
          inset: 0;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          pointer-events: none;
        }
        .reservation-card__logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 100%;
          height: 100%;
          max-width: none;
          max-height: none;
          padding: 0;
          color: #c4a35a;
        }
        .reservation-card__logo img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
        }
        .reservation-card__logo span {
          font-family: "Playfair Display", Georgia, serif;
          font-size: clamp(13px, 0.95vw, 17px);
          font-weight: 620;
          line-height: 1.02;
          text-align: center;
        }
        .reservation-card__meta {
          position: absolute;
          left: clamp(14px, 1.1vw, 20px);
          right: clamp(14px, 1.1vw, 20px);
          bottom: clamp(13px, 1vw, 18px);
          z-index: 3;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .reservation-card__title {
          font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
          font-size: clamp(16px, 1.02vw, 21px);
          color: #fffaf1;
          font-weight: 740;
          text-shadow: 0 3px 18px rgba(0, 0, 0, 0.76);
        }
        .reservation-card--dining .reservation-card__title {
          font-size: clamp(15px, 0.98vw, 19px);
          font-weight: 720;
          text-shadow: none;
        }
        .reservation-card__hitarea {
          position: absolute;
          inset: 0;
          z-index: 2;
          background: transparent;
          border: 0;
          cursor: pointer;
        }
      `}} />
    </div>
  );
}
