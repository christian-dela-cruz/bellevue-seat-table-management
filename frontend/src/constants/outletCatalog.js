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

  if (normalized === "qsina") return "Qsina Restaurant";
  if (normalized === "hanakazu") return "Hanakazu Japanese Restaurant";

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
