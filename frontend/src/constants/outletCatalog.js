export const ADMIN_OUTLET_GROUPS = [
  {
    id: "main-wing",
    label: "Main Wing",
    rooms: [
      "Alabang Function Room",
      "Laguna Ballroom 1",
      "Laguna Ballroom 2",
      "20/20 Function Room A",
      "20/20 Function Room B",
      "20/20 Function Room C",
      "Business Center",
    ],
  },
  {
    id: "tower-wing",
    label: "Tower Wing",
    rooms: [
      "Tower 1",
      "Tower 2",
      "Tower 3",
      "Grand Ballroom A",
      "Grand Ballroom B",
      "Grand Ballroom C",
    ],
  },
  {
    id: "dining",
    label: "Dining",
    rooms: [
      "Qsina Restaurant",
      "Hanakazu Japanese Restaurant",
      "Phoenix Court",
    ],
  },
];

export const ADMIN_OUTLET_ROOMS = ADMIN_OUTLET_GROUPS.flatMap((group) => group.rooms);

export function canonicalOutletName(roomName) {
  const name = String(roomName || "").trim();
  const normalized = name.toLowerCase();

  if (normalized === "qsina" || normalized === "qsina restaurant") return "Qsina Restaurant";
  if (normalized === "hanakazu" || normalized === "hanakazu japanese restaurant") return "Hanakazu Japanese Restaurant";

  return name;
}

function groupId(value) {
  return String(value || "other")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "other";
}

function isDiningVenue(venue, name) {
  const type = String(venue?.type || venue?.category || "").toLowerCase();
  const wing = String(venue?.wing || "").toLowerCase();
  const normalized = String(name || "").toLowerCase();

  return type.includes("dining")
    || type.includes("restaurant")
    || wing.includes("dining")
    || normalized.includes("restaurant")
    || normalized.includes("qsina")
    || normalized.includes("hanakazu")
    || normalized.includes("phoenix");
}

function collectUniqueVenues(venues = []) {
  const byKey = new Map();

  const addVenue = (venue) => {
    if (!venue) return;
    const archived = Boolean(venue.is_archived || venue?.metadata?.archived_reason);
    if (archived) return;

    const key = venue.id ? `id:${venue.id}` : `name:${normalizedName(venue.display_name || venue.name)}`;
    if (!byKey.has(key)) byKey.set(key, venue);

    if (Array.isArray(venue.children)) {
      venue.children.forEach(addVenue);
    }
  };

  venues.forEach(addVenue);
  return Array.from(byKey.values());
}

export function buildOutletGroupsFromVenues(venues = []) {
  const groups = new Map();
  const seenRooms = new Set();

  const sortedVenues = collectUniqueVenues(venues).sort((a, b) => {
    const orderA = Number(a?.display_order ?? 9999);
    const orderB = Number(b?.display_order ?? 9999);
    if (orderA !== orderB) return orderA - orderB;
    return String(a?.display_name || a?.name || "").localeCompare(String(b?.display_name || b?.name || ""), undefined, {
      numeric: true,
      sensitivity: "base",
    });
  });

  sortedVenues.forEach((venue) => {
    const roomName = canonicalOutletName(venue?.display_name || venue?.name);
    if (!roomName) return;

    const normalizedRoom = normalizedName(roomName);
    if (seenRooms.has(normalizedRoom)) return;
    seenRooms.add(normalizedRoom);

    const groupLabel = isDiningVenue(venue, roomName)
      ? "Dining"
      : (venue?.wing || venue?.parent?.wing || outletGroupLabel(roomName) || "Other");
    const id = groupId(groupLabel);

    if (!groups.has(id)) {
      groups.set(id, { id, label: groupLabel, rooms: [] });
    }

    groups.get(id).rooms.push(roomName);
  });

  const order = new Map([
    ["main-wing", 0],
    ["tower-wing", 1],
    ["dining", 2],
    ["other", 99],
  ]);

  return Array.from(groups.values())
    .map((group) => ({
      ...group,
      rooms: Array.from(new Set(group.rooms)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })),
    }))
    .sort((a, b) => (order.get(a.id) ?? 50) - (order.get(b.id) ?? 50) || a.label.localeCompare(b.label));
}

export function buildOutletRowsFromVenues(venues = []) {
  return collectUniqueVenues(venues)
    .map((venue) => {
      const name = canonicalOutletName(venue?.display_name || venue?.name);
      if (!name) return null;

      return {
        id: venue.id,
        venue_id: venue.id,
        name,
        wing: isDiningVenue(venue, name) ? "Dining" : (venue?.wing || venue?.parent?.wing || outletGroupLabel(name)),
        type: venue?.type || venue?.category || (isDiningVenue(venue, name) ? "dining" : "function"),
        slug: venue?.slug,
        reservation_route: venue?.reservation_route,
        display_order: venue?.display_order ?? 9999,
        children: Array.isArray(venue?.children)
          ? venue.children.map((child) => canonicalOutletName(child?.display_name || child?.name)).filter(Boolean)
          : [],
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const orderA = Number(a.display_order ?? 9999);
      const orderB = Number(b.display_order ?? 9999);
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    });
}

export function outletGroupLabel(roomName) {
  const name = canonicalOutletName(roomName).toLowerCase();

  if (name.includes("qsina") || name.includes("hanakazu") || name.includes("phoenix") || name.includes("restaurant")) {
    return "Dining";
  }

  if (name.includes("tower") || name.includes("grand ballroom")) {
    return "Tower Wing";
  }

  return "Main Wing";
}

function normalizedName(value) {
  return canonicalOutletName(value).toLowerCase();
}

function scopeAllowsGroup(scopeSet, group) {
  return scopeSet.has(String(group.id || "").toLowerCase())
    || scopeSet.has(String(group.label || "").toLowerCase());
}

function scopeAllowsRoom(scopeSet, room, group) {
  const canonical = normalizedName(room);
  const raw = String(room || "").toLowerCase();

  if (scopeSet.has(canonical) || scopeSet.has(raw)) return true;
  if (scopeAllowsGroup(scopeSet, group)) return true;

  if (canonical.includes("laguna ballroom") && scopeSet.has("laguna ballroom")) return true;
  if (canonical.includes("20/20 function room") && scopeSet.has("20/20 function room")) return true;
  if (canonical.includes("grand ballroom") && scopeSet.has("grand ballroom")) return true;
  if (canonical.includes("tower") && scopeSet.has("tower ballroom")) return true;

  return false;
}

export function getScopedOutletGroups(user, groups = ADMIN_OUTLET_GROUPS) {
  if (!user || user.scope_type !== "assigned") {
    return groups;
  }

  const scope = Array.isArray(user.outlet_scope) ? user.outlet_scope : [];
  const namedScope = scope
    .filter((value) => Number.isNaN(Number(value)))
    .map((value) => String(value || "").trim())
    .filter(Boolean);

  if (!namedScope.length) {
    return [];
  }

  const scopeSet = new Set(namedScope.flatMap((value) => [
    value.toLowerCase(),
    normalizedName(value),
  ]));

  return groups
    .map((group) => ({
      ...group,
      rooms: group.rooms.filter((room) => scopeAllowsRoom(scopeSet, room, group)),
    }))
    .filter((group) => group.rooms.length > 0);
}

export function getScopedOutletRooms(user, groups = ADMIN_OUTLET_GROUPS) {
  return getScopedOutletGroups(user, groups).flatMap((group) => group.rooms.map(canonicalOutletName));
}

export function canAccessOutlet(user, outletName, groups = ADMIN_OUTLET_GROUPS) {
  if (!user || user.scope_type !== "assigned") return true;
  const allowed = new Set(getScopedOutletRooms(user, groups).map((room) => normalizedName(room)));
  return allowed.has(normalizedName(outletName));
}
