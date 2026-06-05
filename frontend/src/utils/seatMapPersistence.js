// src/utils/seatMapPersistence.js
// Modified for Staged Publishing Workflow
const STORAGE_PREFIX = "seatmap";
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

function getHeaders() {
  const token = localStorage.getItem("admin_token") || localStorage.getItem("auth_token") || "";
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// ─── ADMIN FETCH (Draft or Published) ─────────────────────────────────────────
export async function fetchAdminSeatmap(venueId) {
  try {
    const res = await fetch(`${API_BASE_URL}/seatmap/admin/id/${venueId}`, {
      headers: getHeaders()
    });
    const data = await res.json();
    console.log("[DEBUG] fetchAdminSeatmap response data:", data);
    if (data.success) {
      return data;
    } else {
      console.error("fetchAdminSeatmap returned success: false", data);
    }
  } catch (err) {
    console.error("Failed to fetch admin seatmap:", err);
  }
  return null;
}

// ─── ADMIN SAVE DRAFT ─────────────────────────────────────────────────────────
export async function saveDraftSeatmap(venueId, data) {
  try {
    const res = await fetch(`${API_BASE_URL}/seatmap/admin/id/${venueId}/draft`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    return result.success;
  } catch (err) {
    console.error("Failed to save draft:", err);
    return false;
  }
}

// ─── ADMIN PUBLISH ────────────────────────────────────────────────────────────
export async function publishSeatmap(venueId) {
  try {
    const res = await fetch(`${API_BASE_URL}/seatmap/admin/id/${venueId}/publish`, {
      method: "POST",
      headers: getHeaders(),
    });
    const result = await res.json();
    
    // Clear the legacy localStorage keys since we now rely on DB
    // We optionally keep a single key just to trigger storage events if needed,
    // but guests should be pulling from the live API now.
    try {
      window.dispatchEvent(new CustomEvent("seatmap:published", { detail: { venueId } }));
      const bc = new BroadcastChannel("seatmap_updates");
      bc.postMessage({ type: "seatmap:published", venueId });
      bc.close();
    } catch {}

    return { success: result.success, message: result.message || "Unknown error" };
  } catch (err) {
    console.error("Failed to publish seatmap:", err);
    return { success: false, message: err.message };
  }
}

// ─── LIVE FETCH (Guests) ──────────────────────────────────────────────────────
export async function fetchLiveSeatmap(venueId, date = '', time = '', guests = 1) {
  try {
    let url = `${API_BASE_URL}/seatmap/id/${venueId}`;
    const params = new URLSearchParams();
    if (date) params.append('event_date', date);
    if (time) params.append('event_time', time);
    if (guests) params.append('guests', guests);
    
    const qs = params.toString();
    if (qs) url += `?${qs}`;

    const res = await fetch(url, { headers: getHeaders() });
    const data = await res.json();
    if (data.success) {
      return data;
    }
  } catch (err) {
    console.error("Failed to fetch live seatmap:", err);
  }
  return null;
}

// ─── LEGACY FALLBACKS (Keep so existing code doesn't crash until fully migrated) ───
export function getRoomData(wing, room, defaultData) {
  return defaultData;
}
export function saveRoomData(wing, room, tableData) {}
export function dispatchSeatMapUpdate(wing, room, data, venueId = null) {}
export function subscribeToSeatMapChanges(callback) {
  return () => {};
}