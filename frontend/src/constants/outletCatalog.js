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
