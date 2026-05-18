function normaliseStatus(raw) {
  const status = String(raw || "available").toLowerCase();
  if (["pending", "approved", "reserved", "unavailable"].includes(status)) return "unavailable";
  return "available";
}

function compact(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function normaliseTableKey(value) {
  let key = compact(value).replace(/^table/, "");
  if (!key) return "";
  if (key === "standalone") return key;
  if (!key.startsWith("t")) key = `t${key}`;
  return key;
}

function normaliseSeatKey(value) {
  return compact(value)
    .replace(/^seat/, "")
    .replace(/^s(?=\d)/, "");
}

function seatParts(value) {
  return String(value ?? "")
    .split(",")
    .map(part => normaliseSeatKey(part))
    .filter(Boolean);
}

function addStatus(map, table, seat, status) {
  const tableKey = normaliseTableKey(table);
  const seatKey = normaliseSeatKey(seat);
  if (!tableKey) return;

  if (seatKey) {
    map.set(`${tableKey}|${seatKey}`, status);
    return;
  }

  map.set(tableKey, status);
}

function buildStatusMap(apiData) {
  const map = new Map();
  const rows = Array.isArray(apiData)
    ? apiData
    : Array.isArray(apiData?.data)
      ? apiData.data
      : Array.isArray(apiData?.tables)
        ? apiData.tables
        : [];

  rows.forEach(row => {
    const status = normaliseStatus(row?.status);
    if (status === "available") return;

    if (Array.isArray(row?.seats)) {
      row.seats.forEach(seat => {
        addStatus(map, row.id ?? row.table ?? row.table_number, seat.num ?? seat.label ?? seat.id, seat.status);
      });
      return;
    }

    const table = row?.table ?? row?.table_number ?? row?.tableNo ?? row?.tableId ?? row?.table_id;
    const seats = seatParts(row?.seat ?? row?.seat_number ?? row?.seatNo ?? row?.seat_id ?? row?.seatId);

    if (seats.length) {
      seats.forEach(seat => addStatus(map, table, seat, status));
      return;
    }

    addStatus(map, table, null, status);
  });

  return map;
}

function availableStatus(previousStatus, preserveMaintenance) {
  return preserveMaintenance && previousStatus === "maintenance" ? "maintenance" : "available";
}

export function mergeReservationStatusIntoLayout(localLayout, apiData, options = {}) {
  if (!localLayout) return localLayout;

  const preserveMaintenance = options.preserveMaintenance !== false;
  const statusMap = buildStatusMap(apiData);

  const tables = (localLayout.tables || []).map(table => {
    const tableKey = normaliseTableKey(table.id ?? table.label);
    return {
      ...table,
      seats: (table.seats || []).map(seat => {
        const seatKey = normaliseSeatKey(seat.num ?? seat.label ?? seat.id);
        const status =
          statusMap.get(`${tableKey}|${seatKey}`) ??
          statusMap.get(tableKey) ??
          availableStatus(seat.status, preserveMaintenance);

        return { ...seat, status };
      }),
    };
  });

  const standaloneSeats = (localLayout.standaloneSeats || []).map(seat => {
    const seatKey = normaliseSeatKey(seat.num ?? seat.label ?? seat.id);
    const status =
      statusMap.get(`${normaliseTableKey("STANDALONE")}|${seatKey}`) ??
      statusMap.get(seatKey) ??
      availableStatus(seat.status, preserveMaintenance);

    return { ...seat, status };
  });

  return { ...localLayout, tables, standaloneSeats };
}
