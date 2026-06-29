import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { authAPI } from "../../services/authAPI";
import { useAdminTheme, C, F } from "../../context/AdminThemeContext";
import { reservationAPI } from "../../services/reservationAPI";
import { canAccessOutlet, canonicalOutletName } from "../../constants/outletCatalog";
import bellevueLogo from "../../assets/bellevue-logo.png";

// ─── Sound / Voice Notifications ─────────────────────────────────────────────
let _alertId = null;
function stopAlert() { if (_alertId) { clearInterval(_alertId); _alertId = null; } }

// Preload voices to prevent getVoices() returning empty array on initial calls
if (typeof window !== "undefined" && window.speechSynthesis) {
  window.speechSynthesis.getVoices();
  window.speechSynthesis.onvoiceschanged = () => {
    window.speechSynthesis.getVoices();
  };
}

// Persistent global AudioContext with user-gesture auto-unlocking
let globalAudioCtx = null;
const unlockAudio = () => {
  try {
    if (!globalAudioCtx) {
      globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (globalAudioCtx.state === "suspended") {
      globalAudioCtx.resume();
    }
  } catch {}
};
if (typeof window !== "undefined") {
  window.addEventListener("click", unlockAudio, { once: true });
  window.addEventListener("keydown", unlockAudio, { once: true });
}

function _beep(notes, onDone) {
  try {
    if (!globalAudioCtx) {
      globalAudioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    const playNext = (index) => {
      if (index >= notes.length) {
        if (onDone) onDone();
        return;
      }

      const { f, d, w = "sine" } = notes[index];

      const playNote = () => {
        try {
          const o = globalAudioCtx.createOscillator();
          const g = globalAudioCtx.createGain();

          o.connect(g);
          g.connect(globalAudioCtx.destination);

          o.type = w;
          o.frequency.value = f;
          g.gain.value = 0.18;

          o.start();

          const ref = { o, g };

          setTimeout(() => {
            try {
              o.stop();
              o.disconnect();
              g.disconnect();
            } catch (e) {}
            ref.o = null;
            ref.g = null;
            playNext(index + 1);
          }, d * 1000);
        } catch (e) {
          console.error("[Audio] Note play error:", e);
          playNext(index + 1);
        }
      };

      if (globalAudioCtx.state === "suspended") {
        globalAudioCtx.resume().then(playNote).catch(() => {
          if (onDone) onDone();
        });
      } else {
        playNote();
      }
    };

    playNext(0);
  } catch (err) {
    console.error("[Audio] Beep error:", err);
    if (onDone) onDone();
  }
}

const DEFAULT_PREFERENCES = {
  reservationAlerts: true,
  cancellationAlerts: true,
  reportNotifications: false,
  systemUpdates: true,
  // Notification Audio & Voice settings
  enableChimeAlerts: true,
  enableVoiceAlerts: true,
  voiceAnnouncePending: true,
  voiceAnnounceApproved: true,
  voiceAnnounceReminders: true,
  voiceGender: "female",
  voiceAccent: "default",
  voiceTone: "standard",
  voiceRate: 0.88,
  voicePitch: 1.0,
};

const PREFERENCE_KEY = "bellevue_account_preferences";

function readStoredPreferences() {
  try {
    const raw = localStorage.getItem(PREFERENCE_KEY);
    if (!raw) return DEFAULT_PREFERENCES;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      voiceAnnouncePending: parsed.voiceAnnouncePending ?? true,
      voiceAnnounceApproved: parsed.voiceAnnounceApproved ?? true,
      voiceAnnounceReminders: parsed.voiceAnnounceReminders ?? true,
      enableChimeAlerts: parsed.enableChimeAlerts ?? true,
      enableVoiceAlerts: parsed.enableVoiceAlerts ?? true,
      voiceGender: parsed.voiceGender ?? "female",
      voiceAccent: parsed.voiceAccent ?? "default",
      voiceTone: parsed.voiceTone ?? "standard",
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function getVoiceConfiguration(gender = "female", tone = "standard", voicesList, baseRate = 0.88, basePitch = 1.0) {
  const result = {
    voice: null,
    rate: baseRate,
    pitch: basePitch
  };

  const list = (voicesList && voicesList.length > 0)
    ? voicesList
    : (typeof window !== "undefined" && window.speechSynthesis
       ? window.speechSynthesis.getVoices().filter(v => v.lang.toLowerCase().startsWith("en"))
       : []);

  if (list.length === 0) return result;

  // 1. Filter by gender
  const isMalePref = gender === "male";
  let genderFiltered = [];
  if (isMalePref) {
    genderFiltered = list.filter(v => 
      /david|george|mark|ravi|daniel|richard|steve|alex|fred|male/i.test(v.name)
    );
  } else {
    genderFiltered = list.filter(v => 
      /zira|samantha|susan|hazel|heather|karen|moira|tessa|veena|siri|female/i.test(v.name)
    );
  }

  if (genderFiltered.length === 0) {
    if (isMalePref) {
      genderFiltered = list.filter(v => /david|george|mark|ravi|daniel|richard|steve|alex|fred|male/i.test(v.name));
    } else {
      genderFiltered = list.filter(v => /zira|samantha|susan|hazel|heather|karen|moira|tessa|veena|siri|female/i.test(v.name));
    }
  }

  const finalSelectionList = genderFiltered.length > 0 ? genderFiltered : list;

  // 2. Map tone parameters and choose different index voices if available to make them uniquely distinct
  let selectedVoice = null;
  let pitchMultiplier = 1.0;
  let rateMultiplier = 1.0;

  let genderPitchAdjustment = isMalePref ? 0.90 : 1.05;

  if (tone === "standard") {
    selectedVoice = finalSelectionList[0];
    pitchMultiplier = 1.0;
    rateMultiplier = 1.0;
  } else if (tone === "natural") {
    // Natural / Casual: slightly lower pitch, slower rate for a relaxed conversational cadence
    selectedVoice = finalSelectionList.find(v => /google|natural|premium|neural/i.test(v.name)) || finalSelectionList[1] || finalSelectionList[0];
    pitchMultiplier = 0.90;
    rateMultiplier = 0.85;
  } else if (tone === "clear") {
    // Energetic / Clear: higher pitch, faster rate to sound alert, energetic and crisp
    selectedVoice = finalSelectionList[2] || finalSelectionList[0];
    pitchMultiplier = 1.20;
    rateMultiplier = 1.15;
  } else if (tone === "warm") {
    // Deep / Warm: significantly lower pitch, slower speed for a warm, soothing character
    selectedVoice = finalSelectionList[3] || finalSelectionList[1] || finalSelectionList[0];
    pitchMultiplier = 0.75;
    rateMultiplier = 0.80;
  }

  result.voice = selectedVoice || list[0];
  result.pitch = Math.max(0.5, Math.min(2.0, basePitch * pitchMultiplier * genderPitchAdjustment));
  result.rate = Math.max(0.5, Math.min(2.0, baseRate * rateMultiplier));

  return result;
}

function playPendingChime(onDone) {
  const prefs = readStoredPreferences();
  if (prefs.enableChimeAlerts) {
    _beep([{ f: 1046, d: .13 }, { f: 784, d: .13 }, { f: 523, d: .22 }], onDone);
  } else {
    if (onDone) onDone();
  }
}

function playApproveSound(onDone) {
  const prefs = readStoredPreferences();
  if (prefs.enableChimeAlerts) {
    _beep([{ f: 523, d: .08 }, { f: 659, d: .08 }, { f: 784, d: .08 }, { f: 1047, d: .20 }], onDone);
  } else {
    if (onDone) onDone();
  }
}

function speakText(text) {
  if (!window.speechSynthesis) return;
  const prefs = readStoredPreferences();
  if (!prefs.enableVoiceAlerts) return;

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  
  const v = window.speechSynthesis.getVoices();
  const config = getVoiceConfiguration(
    prefs.voiceGender || "female",
    prefs.voiceTone || "standard",
    v,
    parseFloat(prefs.voiceRate ?? 0.88),
    parseFloat(prefs.voicePitch ?? 1.0)
  );

  u.rate = config.rate;
  u.pitch = config.pitch;
  u.volume = 1;
  if (config.voice) u.voice = config.voice;

  window.speechSynthesis.speak(u);
}

// Check sessionStorage for already alerted ids
const ALERTED_STORAGE_KEY = "bellevue_alerted_reservations";
function getAlertedIds() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(ALERTED_STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function markAsAlerted(id) {
  try {
    const set = getAlertedIds();
    set.add(String(id));
    sessionStorage.setItem(ALERTED_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

function normaliseRow(r) {
  const isWS = !r.room && !r.eventDate && (r.event_date || r.eventDate);
  if (isWS) {
    return {
      ...r,
      db_id: Number(r.db_id ?? r.id),
      id: r.reference_code ?? String(r.id),
      room: r.room || r.venue?.name || r.venue || "Alabang Function Room",
      table: r.table_number || r.table,
      seat: r.seat_number || r.seat,
      guests: r.guests_count || r.guests || r.guests_number,
      eventDate: r.event_date || r.eventDate,
      eventTime: r.event_time || r.eventTime,
      specialRequests: r.special_requests || r.specialRequests || r.notes || r.remarks,
      submittedTimestamp: r.submitted_timestamp || r.submittedTimestamp,
      guest_name: r.name || r.guest_name,
      status: r.status || r.reservationStatus || r.reservation_status || 'pending'
    };
  }
  return {
    ...r,
    db_id: Number(r.db_id ?? r.id),
    id: r.reference_code ?? String(r.id),
    guests: r.guests_count || r.guests || r.guests_number || r.guests,
    specialRequests: r.special_requests || r.specialRequests || r.notes || r.remarks,
    guest_name: r.name || r.guest_name,
    status: r.status || r.reservationStatus || r.reservation_status || 'pending'
  };
}

function isPending(r) {
  const s = (r.status || "").toLowerCase().trim();
  return s === "pending" || s === "awaiting" || s === "under review";
}

function isApproved(r) {
  const s = (r.status || "").toLowerCase().trim();
  return ["reserved","approved","confirmed","done","completed","accepted"].includes(s);
}

const REMINDED_STORAGE_KEY = "bellevue_reminded_reservations";
function getRemindedKeys() {
  try {
    return new Set(JSON.parse(sessionStorage.getItem(REMINDED_STORAGE_KEY) || "[]"));
  } catch {
    return new Set();
  }
}
function markAsReminded(key) {
  try {
    const set = getRemindedKeys();
    set.add(String(key));
    sessionStorage.setItem(REMINDED_STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {}
}

function parseEventDate(d, t) {
  if (!d) return null;
  let b = new Date(d);
  if (isNaN(b)) {
    const cleanDate = String(d).trim().replace(/[^\d\-\/]/g, '');
    b = new Date(cleanDate);
    if (isNaN(b)) return null;
  }
  if (t) {
    const m = t.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
    if (m) {
      let h = +m[1];
      if (m[3] && m[3].toUpperCase() === "PM" && h !== 12) h += 12;
      if (m[3] && m[3].toUpperCase() === "AM" && h === 12) h = 0;
      b.setHours(h, +m[2], 0, 0);
    }
  }
  return b;
}

function relLabel(ms) {
  if (ms <= 0) return "now";
  const m = Math.round(ms / 60000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r === 0 ? `${h} hr` : `${h} hr ${r} min`;
}

function playAlertThenSpeak(text) {
  stopAlert();
  const prefs = readStoredPreferences();
  if (prefs.enableChimeAlerts) {
    _beep([{ f: 880, d: .12, w: "square" }, { f: 880, d: .12, w: "square" }, { f: 1100, d: .24, w: "square" }], () => {
      if (prefs.voiceAnnounceReminders) {
        speakText(text);
      }
    });
    _alertId = setInterval(() => {
      const livePrefs = readStoredPreferences();
      if (livePrefs.enableChimeAlerts) {
        _beep([{ f: 880, d: .12, w: "square" }, { f: 880, d: .12, w: "square" }, { f: 1100, d: .24, w: "square" }]);
      }
    }, 4000);
  } else {
    if (prefs.voiceAnnounceReminders) {
      speakText(text);
    }
  }
}

function AdminNavbar({ pendingCount: pendingProp, leftContent = null }) {
  const { isDark, toggleTheme } = useAdminTheme();
  const navigate = useNavigate();
  const location = useLocation();
  const [pending, setPending] = useState(pendingProp ?? 0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMessage, setProfileMessage] = useState(null);
  const currentUser = authAPI.getCurrentUser() || {};
  const [profile, setProfile] = useState({
    name: currentUser.name || "",
    email: currentUser.email || "",
    username: currentUser.username || "",
    current_password: "",
    password: "",
    password_confirmation: "",
  });

  const [notifications, setNotifications] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [loadingNotifs, setLoadingNotifs] = useState(false);
  const [hoveredNotifId, setHoveredNotifId] = useState(null);
  const [showTopShadow, setShowTopShadow] = useState(false);
  const [showBottomShadow, setShowBottomShadow] = useState(false);
  const listRef = useRef(null);
  const popoverRef = useRef(null);
  const buttonRef = useRef(null);

  const handleScroll = () => {
    if (!listRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = listRef.current;
    setShowTopShadow(scrollTop > 2);
    setShowBottomShadow(scrollTop + clientHeight < scrollHeight - 2);
  };

  useEffect(() => {
    if (dropdownOpen) {
      const timer = setTimeout(() => {
        handleScroll();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setShowTopShadow(false);
      setShowBottomShadow(false);
    }
  }, [dropdownOpen, notifications]);

  const canAcknowledge = authAPI.hasPermission("acknowledge_notifications");

  // Scoping helper
  const isScoped = (res) => {
    const outlet = canonicalOutletName(res.room || res.venue?.name || res.venue || "Unassigned Outlet");
    return canAccessOutlet(currentUser, outlet);
  };

  // Helper to determine if a reservation is read
  const isRead = (res) => {
    if (!res.seen_by) return false;
    const key = String(currentUser.id || currentUser.email || currentUser.name || "");
    if (!key) return false;
    return !!res.seen_by[key];
  };

  const checkNavbarAlerts = (list) => {
    const activeAlerts = list.filter(isApproved).map(res => {
      const id = res.id ?? res.db_id;
      const key = `${id}-alert`;
      const storedAck = JSON.parse(localStorage.getItem("notification_acknowledgments") || "{}");
      if (storedAck[String(id)]) return null;
      
      const remindedSet = getRemindedKeys();
      if (remindedSet.has(key)) return null;

      const dt = parseEventDate(res.event_date || res.eventDate || res.reservationDate, res.event_time || res.eventTime || res.reservationTime);
      if (!dt) return null;
      
      const diff = dt.getTime() - Date.now();
      if (diff > 0 && diff <= 2 * 3600000) {
        return { res, id, key, diff };
      }
      return null;
    }).filter(Boolean).sort((a, b) => a.diff - b.diff);

    if (!activeAlerts.length) return;
    
    activeAlerts.forEach(({ key }) => markAsReminded(key));
    
    const first = activeAlerts[0].res;
    const rel = relLabel(activeAlerts[0].diff);
    
    if (activeAlerts.length === 1) {
      playAlertThenSpeak(`Reminder. ${first.guest_name || first.name || "A guest"}'s reservation starts in ${rel}.`);
    } else {
      playAlertThenSpeak(`Reminder. ${activeAlerts.length} reservations coming up. Earliest in ${rel}.`);
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setLoadingNotifs(true);
      const resp = await reservationAPI.getAll("?per_page=50");
      const raw = Array.isArray(resp) ? resp : Array.isArray(resp?.data) ? resp.data : [];
      
      const valid = raw.filter(r => {
        const s = (r.status || "").toLowerCase().trim();
        return s !== "deleted" && s !== "archived";
      });

      const scoped = valid.filter(isScoped);
      setNotifications(scoped);
      
      const unreadCount = scoped.filter(r => !isRead(r)).length;
      setPending(unreadCount);
      localStorage.setItem("bellevue_pending_count", unreadCount);

      // Check upcoming reminders globally
      checkNavbarAlerts(scoped);
    } catch (err) {
      console.warn("Failed to fetch notifications in AdminNavbar", err);
    } finally {
      setLoadingNotifs(false);
    }
  };

  // Mark all notifications as read
  const markAllAsRead = async () => {
    const unread = notifications.filter(r => !isRead(r));
    if (!unread.length) return;
    try {
      await Promise.all(unread.map(r => reservationAPI.markSeen(r.db_id ?? r.id)));
      const now = new Date().toISOString();
      const key = String(currentUser.id || currentUser.email || currentUser.name || "");
      setNotifications(prev => prev.map(r => {
        if (!isRead(r)) {
          const seenBy = r.seen_by ? { ...r.seen_by } : {};
          seenBy[key] = {
            id: currentUser.id || null,
            name: currentUser.name || null,
            role: currentUser.role || null,
            seen_at: now
          };
          return { ...r, seen_by: seenBy };
        }
        return r;
      }));
      setPending(0);
      localStorage.setItem("bellevue_pending_count", 0);
      window.dispatchEvent(new CustomEvent("bellevue:notifications-changed"));
    } catch (err) {
      console.warn("Failed to mark all notifications as read", err);
    }
  };

  // Mark single notification as read
  const markAsRead = async (id, e) => {
    if (e) e.stopPropagation();
    try {
      await reservationAPI.markSeen(id);
      const now = new Date().toISOString();
      const key = String(currentUser.id || currentUser.email || currentUser.name || "");
      setNotifications(prev => prev.map(r => {
        if ((r.id === id || r.db_id === id) && !isRead(r)) {
          const seenBy = r.seen_by ? { ...r.seen_by } : {};
          seenBy[key] = {
            id: currentUser.id || null,
            name: currentUser.name || null,
            role: currentUser.role || null,
            seen_at: now
          };
          return { ...r, seen_by: seenBy };
        }
        return r;
      }));
      setPending(prev => Math.max(0, prev - 1));
      window.dispatchEvent(new CustomEvent("bellevue:notifications-changed"));
    } catch (err) {
      console.warn("Failed to mark notification as read", err);
    }
  };

  // Acknowledge alert
  const handleAcknowledge = async (res, e) => {
    if (e) e.stopPropagation();
    try {
      const id = String(res.id ?? res.db_id ?? "");
      const reservationId = Number(res.db_id || res.id);
      const payload = {
        notification_key: id,
        reservation_id: Number.isFinite(reservationId) && reservationId > 0 ? reservationId : null,
        outlet: res.room || res.venue?.name || res.venue || "",
        event_date: res.event_date || res.eventDate || res.reservationDate,
        event_time: res.event_time || res.eventTime || res.reservationTime,
        metadata: { name: res.guest_name || res.name || "Reservation" }
      };
      await reservationAPI.acknowledgeNotifications([payload]);
      const storedAck = JSON.parse(localStorage.getItem("notification_acknowledgments") || "{}");
      storedAck[id] = {
        id,
        name: res.guest_name || res.name || "Reservation",
        room: res.room || res.venue?.name || res.venue || "",
        eventDate: res.event_date || res.eventDate || res.reservationDate,
        eventTime: res.event_time || res.eventTime || res.reservationTime,
        acknowledgedAt: new Date().toISOString(),
        acknowledgedBy: currentUser.name || "Admin"
      };
      localStorage.setItem("notification_acknowledgments", JSON.stringify(storedAck));
      window.dispatchEvent(new CustomEvent("bellevue:notifications-changed"));
      fetchNotifications();
    } catch (err) {
      console.warn("Failed to acknowledge notification", err);
    }
  };

  const handleViewDetails = async (res) => {
    const id = res.id ?? res.db_id;
    if (!isRead(res)) {
      await markAsRead(res.db_id ?? res.id);
    }
    setDropdownOpen(false);
    navigate(`/admin/reservations?id=${id}`);
  };

  // Helper date/time parsers
  const parseEventDate = (d, t) => {
    if (!d) return null;
    let b = new Date(d);
    if (isNaN(b)) {
      const cleanDate = String(d).trim().replace(/[^\d\-\/]/g, '');
      b = new Date(cleanDate);
      if (isNaN(b)) return null;
    }
    if (t) {
      const m = t.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
      if (m) {
        let h = +m[1];
        if (m[3] && m[3].toUpperCase() === "PM" && h !== 12) h += 12;
        if (m[3] && m[3].toUpperCase() === "AM" && h === 12) h = 0;
        b.setHours(h, +m[2], 0, 0);
      }
    }
    return b;
  };

  const fmtTime = (t) => {
    if (!t) return "—";
    const m = t.match(/^(\d{1,2}):(\d{2})$/);
    if (m) {
      const h = +m[1];
      return `${((h+11)%12)+1}:${m[2]} ${h>=12?"PM":"AM"}`;
    }
    return t;
  };

  const fmtDate = (d) => {
    if (!d) return "—";
    const dt = new Date(d);
    return isNaN(dt) ? String(d) : dt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const timeAgo = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays === 1) return "Yesterday";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const getNotificationDetails = (res) => {
    const status = (res.status || "").toLowerCase().trim();
    const isRoomAssigned = !!(res.room || res.venue?.name || res.venue) && (res.room || res.venue?.name || res.venue) !== "Unassigned Outlet";
    const hasBeenUpdated = Array.isArray(res.transaction_history) && res.transaction_history.some(h => h.action === "reservation_updated" || h.action === "details_adjusted");
    if (status === "pending") {
      if (!isRoomAssigned) {
        return {
          type: "room_assignment_needed",
          label: "Room",
          color: "#EF4444",
          bg: "rgba(239, 68, 68, 0.08)",
          description: "needs room assignment"
        };
      }
      return {
        type: "new_request",
        label: "New",
        color: "#C9A84C",
        bg: "rgba(201, 168, 76, 0.08)",
        description: "requested a booking"
      };
    }
    if (status === "cancelled" || status === "canceled") {
      return {
        type: "cancelled",
        label: "Cancelled",
        color: "#EF4444",
        bg: "rgba(239, 68, 68, 0.08)",
        description: "cancelled booking"
      };
    }
    if (hasBeenUpdated) {
      return {
        type: "updated",
        label: "Updated",
        color: "#3B82F6",
        bg: "rgba(59, 130, 246, 0.08)",
        description: "updated details"
      };
    }
    if (status === "reserved" || status === "approved" || status === "confirmed") {
      return {
        type: "approved",
        label: "Approved",
        color: "#10B981",
        bg: "rgba(16, 185, 129, 0.08)",
        description: "booking confirmed"
      };
    }
    if (status === "rejected" || status === "declined") {
      return {
        type: "rejected",
        label: "Declined",
        color: "#6B7280",
        bg: "rgba(107, 114, 128, 0.08)",
        description: "booking declined"
      };
    }
    return {
      type: "info",
      label: "Update",
      color: "#6B7280",
      bg: "rgba(107, 114, 128, 0.08)",
      description: "status updated"
    };
  };

  // Keyboard and click outside listeners
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleClickOutside = (event) => {
      if (
        popoverRef.current && !popoverRef.current.contains(event.target) &&
        buttonRef.current && !buttonRef.current.contains(event.target)
      ) {
        setDropdownOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [dropdownOpen]);

  // Sync, Poll and Event listeners
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    const handleNotificationsChanged = () => {
      fetchNotifications();
    };
    window.addEventListener("bellevue:notifications-changed", handleNotificationsChanged);
    return () => {
      clearInterval(interval);
      window.removeEventListener("bellevue:notifications-changed", handleNotificationsChanged);
    };
  }, []);

  // Real-time WebSocket connection for global audio & voice alerts
  useEffect(() => {
    let ws = null;
    let isMounted = true;
    let reconnectTimer = null;

    const wsHost = import.meta.env.VITE_WS_HOST || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' ? 'localhost' : window.location.hostname);
    const wsPort = import.meta.env.VITE_WS_PORT || "6001";
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${wsHost}:${wsPort}`;

    const connect = () => {
      if (!isMounted) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("[Navbar WS] Connected successfully");
        };

        ws.onclose = () => {
          ws = null;
          if (!isMounted) return;
          reconnectTimer = setTimeout(connect, 5000);
        };

        ws.onerror = () => {
          if (ws && ws.readyState === WebSocket.OPEN) ws.close();
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            const eventName = data?.event;
            if (eventName === "connected") return;
            if (eventName === "ReservationCreated" || eventName === "ReservationUpdated" || eventName === "updated") {
              const payload = data?.payload?.reservation ?? data?.payload;
              if (payload && typeof payload === "object") {
                const res = normaliseRow(payload);
                const resId = String(res.id ?? res.db_id);
                const statusKey = (res.status || "").toLowerCase().trim();
                const alertKey = `${resId}-${statusKey}`;

                const isSeenUpdate = data?.payload?.seen === true || data?.seen === true;
                const alertedSet = getAlertedIds();
                if (!alertedSet.has(alertKey) && !isSeenUpdate) {
                  const isNewPending = eventName === "ReservationCreated" && isPending(res);
                  const isTransitionedApproved = isApproved(res);

                  if (isNewPending || isTransitionedApproved) {
                    markAsAlerted(alertKey);

                    const outlet = canonicalOutletName(res.room || res.venue?.name || res.venue || "Unassigned Outlet");
                    const hasAccess = canAccessOutlet(currentUser, outlet);

                    if (hasAccess) {
                      const guestName = res.guest_name || "A guest";
                      const outletDisplay = res.room || res.venue?.name || res.venue || "";

                      if (isNewPending) {
                        playPendingChime(() => {
                          const prefs = readStoredPreferences();
                          if (prefs.voiceAnnouncePending) {
                            speakText(`New reservation received from ${guestName} ${outletDisplay ? `for ${outletDisplay}` : ""}`);
                          }
                        });
                      } else if (isTransitionedApproved) {
                        playApproveSound(() => {
                          const prefs = readStoredPreferences();
                          if (prefs.voiceAnnounceApproved) {
                            speakText(`Reservation approved for ${guestName} ${outletDisplay ? `for ${outletDisplay}` : ""}`);
                          }
                        });
                      }
                    }
                  }
                }

                // Trigger sync across components
                window.dispatchEvent(new CustomEvent("bellevue:notifications-changed"));
              }
            }
          } catch (err) {
            console.error("[Navbar WS] Parse error:", err);
          }
        };
      } catch (err) {
        console.error("[Navbar WS] Connection failed:", err);
      }
    };

    connect();

    return () => {
      isMounted = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
      stopAlert();
    };
  }, [currentUser]);

  // Keep badge in sync if parent passes pendingCount prop
  useEffect(() => {
    if (pendingProp !== undefined) { setPending(pendingProp); }
  }, [pendingProp]);

  useEffect(() => {
    const openAccountSettings = () => {
      navigate('/admin/settings');
    };

    window.addEventListener("bellevue:open-account-settings", openAccountSettings);
    return () => window.removeEventListener("bellevue:open-account-settings", openAccountSettings);
  }, [navigate]);

  const isNotifActive = location.pathname === "/admin/notifications";
  const roleLabel = roleLabels[currentUser.role] || currentUser.role || "Admin";
  const displayName = currentUser.name || currentUser.username || "Admin";
  const initials = String(displayName)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "A";

  const submitProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setProfileMessage(null);

    try {
      const response = await authAPI.updateProfile({
        name: profile.name,
        email: profile.email,
        username: profile.username,
        ...(profile.password ? {
          current_password: profile.current_password,
          password: profile.password,
          password_confirmation: profile.password_confirmation,
        } : {}),
      });

      setProfile((prev) => ({
        ...prev,
        name: response.admin?.name || prev.name,
        email: response.admin?.email || prev.email,
        username: response.admin?.username || prev.username,
        current_password: "",
        password: "",
        password_confirmation: "",
      }));
      setProfileMessage({ type: "success", text: "Account updated." });
      setEditingProfile(false);
    } catch (error) {
      setProfileMessage({ type: "error", text: error.message || "Failed to update account." });
    } finally {
      setSavingProfile(false);
    }
  };

  const resetProfileForm = () => {
    const user = authAPI.getCurrentUser() || currentUser;
    setProfile({
      name: user.name || "",
      email: user.email || "",
      username: user.username || "",
      current_password: "",
      password: "",
      password_confirmation: "",
    });
    setProfileMessage(null);
  };

  const closeSettings = () => {
    resetProfileForm();
    setEditingProfile(false);
    setSettingsOpen(false);
  };

  return (
    <nav className="admin-navbar-nav" style={{
      height: 63,
      background: isDark ? "#111009" : "#FFFFFF",
      borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E1E4E8",
      display: "flex",
      alignItems: "center",
      padding: "0 32px",
      justifyContent: "space-between",
      position: "sticky",
      top: 0,
      zIndex: 3000,
    }}>
      <style>{`
        .admin-hamburger-btn { display: flex !important; }
        @media (max-width: 960px) {
          .admin-navbar-nav {
            padding: 0 16px !important;
          }
        }
        @keyframes popoverFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 640px) {
          .admin-notif-popover {
            width: calc(100vw - 82px) !important;
            right: -12px !important;
          }
        }
      `}</style>

      {/* Logo & Hamburger */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          className="admin-hamburger-btn"
          onClick={() => window.dispatchEvent(new CustomEvent("bellevue:toggle-sidebar"))}
          title="Toggle Navigation Menu"
          style={{
            width: 38, height: 38,
            border: "none",
            background: "transparent",
            borderRadius: 8,
            cursor: "pointer",
            alignItems: "center",
            justifyContent: "center",
            color: isDark ? "#EDE8DF" : "#374151",
            transition: "background 0.15s",
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.08)" : "rgba(107,114,128,0.08)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>



        {leftContent}
      </div>

      {/* Right side */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        {/* Theme Toggle Button */}
        <button
          onClick={toggleTheme}
          title={isDark ? "Switch to Light Mode" : "Switch to Dark Mode"}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          style={{
            width: 38, height: 38,
            border: "none",
            background: "transparent",
            borderRadius: 8,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "background 0.15s, color 0.15s",
            color: isDark ? "#C9A84C" : "#374151",
            lineHeight: 0,
          }}
          onMouseEnter={e => {
            e.currentTarget.style.background = isDark
              ? "rgba(201,168,76,0.12)"
              : "rgba(107,114,128,0.08)";
          }}
          onMouseLeave={e => {
            e.currentTarget.style.background = "transparent";
          }}
        >
          {isDark ? (
            /* Sun Icon when dark */
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "none", display: "block", flexShrink: 0 }}><circle cx="12" cy="12" r="5" /><line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" /><line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" /><line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" /><line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" /></svg>
          ) : (
            /* Moon Icon when light */
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ pointerEvents: "none", display: "block", flexShrink: 0 }}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          )}
        </button>

        {/* Bell icon with Dropdown Popover */}
        <div style={{ position: "relative" }}>
          {/* Bell Icon Button */}
          <button
            ref={buttonRef}
            onClick={() => setDropdownOpen(!dropdownOpen)}
            title="Notifications"
            style={{
              width: 38, height: 38,
              border: "none",
              background: dropdownOpen || isNotifActive ? "rgba(201,168,76,0.10)" : "transparent",
              borderRadius: 8,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              transition: "background 0.15s",
              color: dropdownOpen || isNotifActive ? "#C9A84C" : (isDark ? "#EDE8DF" : "#374151"),
              outline: dropdownOpen || isNotifActive ? "1.5px solid rgba(201,168,76,0.35)" : "none",
              lineHeight: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = dropdownOpen || isNotifActive
                ? "rgba(201,168,76,0.16)"
                : (isDark ? "rgba(255,255,255,0.08)" : "rgba(107,114,128,0.08)");
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = dropdownOpen || isNotifActive
                ? "rgba(201,168,76,0.10)"
                : "transparent";
            }}
          >
            <svg
              width="20" height="20" viewBox="0 0 24 24"
              fill="none"
              stroke={dropdownOpen || isNotifActive ? "#C9A84C" : (isDark ? "#EDE8DF" : "#374151")}
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              style={{ pointerEvents: "none", display: "block", flexShrink: 0 }}
            >
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>

            {/* Badge */}
            {pending > 0 && (
              <span style={{
                position: "absolute",
                top: 4, right: 4,
                background: "#EF4444",
                color: "#fff",
                borderRadius: "50%",
                minWidth: 16, height: 16,
                fontSize: 9,
                fontWeight: 800,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: "Montserrat, sans-serif",
                padding: "0 3px",
                lineHeight: 1,
                pointerEvents: "none",
              }}>
                {pending > 99 ? "99+" : pending}
              </span>
            )}
          </button>

          {/* Dropdown Popover */}
          {dropdownOpen && (
            <div
              ref={popoverRef}
              className="admin-notif-popover"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 440,
                maxHeight: 480,
                background: isDark ? "#111009" : "#FFFFFF",
                border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E1E4E8",
                borderRadius: 12,
                boxShadow: isDark ? "0 10px 30px rgba(0,0,0,0.5)" : "0 10px 30px rgba(0,0,0,0.1)",
                display: "flex",
                flexDirection: "column",
                zIndex: 3500,
                overflow: "hidden",
                animation: "popoverFadeIn 0.15s ease",
              }}
            >
              <style>{`
                @keyframes dropdownFadeIn {
                  from { opacity: 0; transform: translateY(8px); }
                  to { opacity: 1; transform: translateY(0); }
                }
              `}</style>
              
              {/* Dropdown Header */}
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "14px 18px",
                borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E1E4E8",
                background: isDark ? "#16150F" : "#FFFFFF",
                boxShadow: showTopShadow 
                  ? (isDark ? "0 4px 12px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.05)") 
                  : "none",
                transition: "box-shadow 0.2s ease",
                zIndex: 15,
              }}>
                <span style={{
                  fontFamily: "Inter, sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  color: isDark ? "#EDE8DF" : "#18140E",
                }}>
                  Notifications ({pending})
                </span>
                {pending > 0 && (
                  <button
                    onClick={markAllAsRead}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "#C9A84C",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      fontFamily: "Inter, sans-serif",
                      padding: 0,
                    }}
                    onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                    onMouseLeave={e => e.currentTarget.style.textDecoration = "none"}
                  >
                    Mark all as read
                  </button>
                )}
              </div>

              {/* Dropdown Content */}
              <div 
                ref={listRef}
                onScroll={handleScroll}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  maxHeight: 360,
                  background: isDark ? "#111009" : "#FFFFFF",
                }}
              >
                {loadingNotifs && notifications.length === 0 ? (
                  <div style={{
                    padding: "32px 16px",
                    textAlign: "center",
                    color: isDark ? "#C7BEAF" : "#7A7060",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 12,
                  }}>
                    Loading notifications...
                  </div>
                ) : notifications.length === 0 ? (
                  <div style={{
                    padding: "40px 16px",
                    textAlign: "center",
                    color: isDark ? "#C7BEAF" : "#7A7060",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 13,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}>
                    <div style={{ fontWeight: 600, color: isDark ? "#EDE8DF" : "#18140E" }}>
                      No new notifications
                    </div>
                    <div style={{ fontSize: 11.5, opacity: 0.8 }}>
                      You're all caught up.
                    </div>
                  </div>
                ) : (
                  notifications.map(res => {
                    const notif = getNotificationDetails(res);
                    const read = isRead(res);
                    const id = res.id ?? res.db_id;
                    const db_id = res.db_id ?? res.id;
                    const outlet = canonicalOutletName(res.room || res.venue?.name || res.venue || "Unassigned Outlet");
                    
                    // Check if alert needs acknowledgment
                    const dt = parseEventDate(res.event_date || res.eventDate || res.reservationDate, res.event_time || res.eventTime || res.reservationTime);
                    const now = Date.now();
                    const diff = dt ? dt.getTime() - now : null;
                    const localAck = JSON.parse(localStorage.getItem("notification_acknowledgments") || "{}");
                    const isAlert = (res.status === "approved" || res.status === "reserved" || res.status === "confirmed") && 
                                    diff !== null && diff > 0 && diff <= 2 * 3600000;
                    const needsAck = isAlert && !localAck[String(id)] && canAcknowledge;

                    const dateStr = fmtDate(res.event_date || res.eventDate || res.reservationDate);
                    const timeStr = fmtTime(res.event_time || res.eventTime || res.reservationTime);
                    const pax = `${res.guests_count || res.guests || 1} pax`;
                    const metadataStr = `${outlet} · ${dateStr}, ${timeStr} · ${pax}`;

                    return (
                      <div
                        key={id}
                        onClick={() => handleViewDetails(res)}
                        className="notif-item"
                        style={{
                          padding: "12px 14px",
                          borderBottom: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid #F0F2F5",
                          borderLeft: read ? "4px solid transparent" : "4px solid #C9A84C",
                          cursor: "pointer",
                          transition: "background 0.15s, opacity 0.15s",
                          position: "relative",
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                          background: read
                            ? (hoveredNotifId === id 
                                ? (isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.015)")
                                : "transparent")
                            : (hoveredNotifId === id 
                                ? (isDark ? "rgba(201,168,76,0.10)" : "rgba(201,168,76,0.07)")
                                : (isDark ? "rgba(201,168,76,0.04)" : "rgba(201,168,76,0.025)"))
                        }}
                        onMouseEnter={() => setHoveredNotifId(id)}
                        onMouseLeave={() => setHoveredNotifId(null)}
                      >
                        {/* Title and Badge Row */}
                        <div style={{
                          display: "flex",
                          alignItems: "flex-start",
                          gap: 8,
                          overflow: "hidden"
                        }}>
                          {/* Status Badge */}
                          <span style={{
                            padding: "1.5px 5px",
                            borderRadius: 4,
                            fontSize: 9,
                            fontWeight: 800,
                            fontFamily: "Inter, sans-serif",
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            color: notif.color,
                            backgroundColor: notif.bg || "rgba(201, 168, 76, 0.08)",
                            flexShrink: 0,
                            lineHeight: 1.15,
                            marginTop: 2,
                            opacity: read ? 0.6 : 1,
                          }}>
                            {notif.label}
                          </span>
                          
                          {/* Title Message */}
                          <span style={{
                            fontFamily: "Inter, sans-serif",
                            fontSize: 12.5,
                            fontWeight: read ? 500 : 700,
                            color: isDark ? (read ? "#A0988E" : "#EDE8DF") : (read ? "#72695E" : "#18140E"),
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            flex: 1,
                            lineHeight: 1.3
                          }}>
                            <strong>{res.guest_name || res.name || "Guest"}</strong> {notif.description}
                          </span>
                        </div>

                        {/* Metadata Row */}
                        <div style={{
                          fontFamily: "Inter, sans-serif",
                          fontSize: 11.5,
                          color: isDark ? "#8A8278" : "#7A7060",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          lineHeight: 1.3,
                          marginTop: 1
                        }} title={metadataStr}>
                          {metadataStr}
                        </div>

                        {/* Bottom Row: Ref Code & Actions */}
                        <div style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: 4,
                          gap: 10,
                          flexWrap: "wrap"
                        }}>
                          <span style={{
                            fontFamily: "Inter, sans-serif",
                            fontSize: 10,
                            color: isDark ? "#8A8278" : "#7A7060",
                            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.045)",
                            padding: "1px 5px",
                            borderRadius: 4,
                            fontWeight: 500,
                            flexShrink: 0
                          }}>
                            Ref {res.reference_code || res.id}
                          </span>
                          
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                            {timeAgo(res.created_at || res.submitted_timestamp) && (
                              <span style={{
                                fontFamily: "Inter, sans-serif",
                                fontSize: 10,
                                color: isDark ? "#8A8278" : "#7A7060",
                                marginRight: 2
                              }}>
                                {timeAgo(res.created_at || res.submitted_timestamp)}
                              </span>
                            )}
                            
                            {needsAck && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleAcknowledge(res, e);
                                }}
                                title="Acknowledge reservation alert"
                                style={{
                                  padding: "3px 6px",
                                  background: "#C9A84C",
                                  color: "#FFF",
                                  border: "none",
                                  borderRadius: 4,
                                  fontSize: 9,
                                  fontWeight: 700,
                                  fontFamily: "Inter, sans-serif",
                                  cursor: "pointer",
                                  boxShadow: "0 2px 6px rgba(201, 168, 76, 0.2)"
                                }}
                              >
                                Acknowledge
                              </button>
                            )}

                            {!read && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  markAsRead(db_id, e);
                                }}
                                title="Mark as Read"
                                style={{
                                  background: isDark ? "#1C1B12" : "#FFFFFF",
                                  border: `1px solid ${isDark ? "rgba(255,255,255,0.15)" : "#E1E4E8"}`,
                                  color: "#C9A84C",
                                  borderRadius: 4,
                                  padding: "2px 6px",
                                  fontSize: 9,
                                  fontWeight: 600,
                                  fontFamily: "Inter, sans-serif",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 2,
                                  boxShadow: "0 2px 6px rgba(0,0,0,0.05)"
                                }}
                              >
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                                Read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Dropdown Footer */}
              <div style={{
                borderTop: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #E1E4E8",
                background: isDark ? "#16150F" : "#FFFFFF",
                boxShadow: showBottomShadow 
                  ? (isDark ? "0 -4px 12px rgba(0,0,0,0.4)" : "0 -2px 8px rgba(0,0,0,0.05)") 
                  : "none",
                transition: "box-shadow 0.2s ease",
                zIndex: 15,
                padding: "2px 0"
              }}>
                <button
                  onClick={() => {
                    setDropdownOpen(false);
                    navigate("/admin/notifications");
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "none",
                    background: "transparent",
                    color: "#C9A84C",
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)"}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  View All Notifications
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginLeft: 4 }}>
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                  </svg>
                </button>
              </div>
            </div>
          )}
        </div>

      </div>
    </nav>
  );
}

const roleLabels = {
  super_admin: "Super Admin",
  admin: "Admin",
  fb_director: "F&B Director",
  outlet_manager: "Outlet Manager",
  supervisor: "Supervisor",
  manager: "Outlet Manager",
  staff: "Staff",
  viewer: "Viewer",
  view_only: "Viewer",
};

export default AdminNavbar;
