import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import bellevueLogo from "../../../assets/bellevue-logo.png";
import hanakazuLogo from "../../../assets/hanakazu-landing-logo.png";
import qsinaLogo from "../../../assets/qsina-landing-logo.png";
import phoenixCourtLogo from "../../../assets/phoenix-landing-logo.png";
import johnnyLogo from "../../../assets/johnny-landing-logo.png";
import pastryCornerLogo from "../../../assets/pastrycorner-landing-logo.png";
import vueBarLogo from "../../../assets/vuebar-landing-logo.png";
import alabangImg from "../../../assets/alabang-function-hires.jpg";
import lagunaImg from "../../../assets/laguna-ballroom-hires.jpg";
import twentyTwentyImg from "../../../assets/twenty-twenty-function-hires.jpg";
import grandBallroomImg from "../../../assets/grand-ballroom-hires.jpg";
import towerBallroomImg from "../../../assets/tower-ballroom-hires.jpg";
import businessCenterImg from "../../../assets/business-center-hires.jpg";
import { venueAPI } from "../../../services/venueAPI";

const fallbackDiningOutlets = [
  {
    title: "Hanakazu",
    route: "/hanakazu",
    logo: hanakazuLogo,
    mark: "Hanakazu",
  },
  {
    title: "Qsina",
    route: "/qsina",
    logo: qsinaLogo,
    mark: "Qsina",
  },
  {
    title: "Phoenix Court",
    route: "/phoenix-court",
    logo: phoenixCourtLogo,
    mark: "Phoenix Court",
  },
];

const fallbackEventVenues = [
  {
    title: "Alabang Function Room",
    image: alabangImg,
    route: "/alabang-reserve",
    imageFocus: "center 48%",
  },
  {
    title: "Laguna Ballroom",
    image: lagunaImg,
    route: "/laguna-reserv1e",
    imageFocus: "center 42%",
    rooms: [
      { label: "1", route: "/laguna-reserv1e" },
      { label: "2", route: "/laguna-reserv2e" },
    ],
  },
  {
    title: "20/20 Function Room",
    image: twentyTwentyImg,
    route: "/twenty-twenty-a",
    imageFocus: "center 46%",
    rooms: [
      { label: "A", route: "/twenty-twenty-a" },
      { label: "B", route: "/twenty-twenty-b" },
      { label: "C", route: "/twenty-twenty-c" },
    ],
  },
  {
    title: "Grand Ballroom",
    image: grandBallroomImg,
    route: "/grand-ballroom-a",
    imageFocus: "center 44%",
    rooms: [
      { label: "A", route: "/grand-ballroom-a" },
      { label: "B", route: "/grand-ballroom-b" },
      { label: "C", route: "/grand-ballroom-c" },
    ],
  },
  {
    title: "Tower Ballroom",
    image: towerBallroomImg,
    route: "/tower1",
    imageFocus: "center 34%",
    rooms: [
      { label: "1", route: "/tower1" },
      { label: "2", route: "/tower2" },
      { label: "3", route: "/tower3" },
    ],
  },
  {
    title: "Business Center",
    image: businessCenterImg,
    route: "/business-center-reserve",
    imageFocus: "center 50%",
  },
];

const roomImageMap = {
  "afc.jpeg": alabangImg,
  "alabangroom-2.jpg": alabangImg,
  "laguna.jpeg": lagunaImg,
  "lagunaroom-1.jpg": lagunaImg,
  "20-20.jpeg": twentyTwentyImg,
  "2020-1.jpg": twentyTwentyImg,
  "grandroom-1.jpg": grandBallroomImg,
  "towerb.jpeg": towerBallroomImg,
  "towerroom-2.jpg": towerBallroomImg,
  "bc.jpeg": businessCenterImg,
  "businesscenter-1.jpg": businessCenterImg,
};

const roomRouteMap = {
  "alabang function room": "/alabang-reserve",
  "laguna ballroom": "/laguna-reserv1e",
  "laguna ballroom 1": "/laguna-reserv1e",
  "laguna ballroom 2": "/laguna-reserv2e",
  "20/20 function room": "/twenty-twenty-a",
  "20/20 function room a": "/twenty-twenty-a",
  "20/20 function room b": "/twenty-twenty-b",
  "20/20 function room c": "/twenty-twenty-c",
  "grand ballroom": "/grand-ballroom-a",
  "grand ballroom a": "/grand-ballroom-a",
  "grand ballroom b": "/grand-ballroom-b",
  "grand ballroom c": "/grand-ballroom-c",
  "tower ballroom": "/tower1",
  "tower 1": "/tower1",
  "tower 2": "/tower2",
  "tower 3": "/tower3",
  "business center": "/business-center-reserve",
  "hanakazu": "/hanakazu",
  "hanakazu japanese restaurant": "/hanakazu",
  "qsina": "/qsina",
  "qsina restaurant": "/qsina",
  "phoenix court": "/phoenix-court",
};

const diningLogoMap = {
  "hanakazu japanese restaurant": hanakazuLogo,
  "hanakazu": hanakazuLogo,
  "hanakazujapaneserestaurant": hanakazuLogo,
  "qsina restaurant": qsinaLogo,
  "qsina": qsinaLogo,
  "qsinarestaurant": qsinaLogo,
  "phoenix court": phoenixCourtLogo,
  "phoenixcourt": phoenixCourtLogo,
  "johnnys steak and grill": johnnyLogo,
  "johnnys steak grill": johnnyLogo,
  "johnny steak and grill": johnnyLogo,
  "johnnys": johnnyLogo,
  "johnny": johnnyLogo,
  "pastry corner": pastryCornerLogo,
  "pastrycorner": pastryCornerLogo,
  "vue bar": vueBarLogo,
  "vuebar": vueBarLogo,
};

function resolveRoomImage(image) {
  if (!image) return businessCenterImg;
  if (/^(https?:|data:|blob:)/i.test(image)) return image;
  const key = String(image).split("/").pop();
  // Bypass static local assets if the path is a custom folder/server directory or URL
  const isCustomPath = String(image).includes("/");
  if (!isCustomPath && roomImageMap[key]) return roomImageMap[key];
  
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");
  if (String(image).startsWith("/")) return `${apiRoot}${image}`;
  if (String(image).includes("/")) return `${apiRoot}/${String(image).replace(/^\/+/, "")}`;
  return `${apiRoot}/images/${image}`;
}

function roomRoute(room) {
  const name = String(room?.name || "").toLowerCase().trim();
  const legacyRoute = roomRouteMap[name];
  const generatedRoute = room?.slug
    ? `/${room.slug}`
    : room?.name
      ? `/${String(room.name).toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`
      : "/venues";
  return legacyRoute || room?.reservation_route || generatedRoute;
}

function resolveDiningLogo(room) {
  const key = canonicalRoomName(room?.display_name || room?.name);
  const slugKey = canonicalRoomName(String(room?.slug || "").replace(/-/g, " "));

  // Prioritize dynamic custom uploads (starts with http/data/blob or contains a path slash '/')
  const isCustomUploaded = room?.image && (
    /^(https?:|data:|blob:)/i.test(String(room.image)) || 
    String(room.image).includes("/")
  );
  if (isCustomUploaded) {
    return resolveRoomImage(room.image);
  }

  const mappedLogo = diningLogoMap[key] || diningLogoMap[slugKey];
  if (mappedLogo) return mappedLogo;
  if (room?.image && /^(https?:|data:|blob:|\/)/i.test(String(room.image))) return resolveRoomImage(room.image);
  return fallbackDiningOutlets.find((outlet) => canonicalRoomName(outlet.title) === key)?.logo || null;
}

function childLabel(child, parentName) {
  const display = child.display_name || child.name || "";
  return display.replace(parentName, "").replace(/Function Room|Ballroom/gi, "").trim() || display || "Room";
}

function canonicalRoomName(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^a-z0-9/ ]/g, "")
    .trim();
}

const canonicalParentNames = [
  "alabang function room",
  "laguna ballroom",
  "20/20 function room",
  "grand ballroom",
  "tower ballroom",
  "business center",
];

const childParentNameMap = {
  "laguna ballroom 1": "laguna ballroom",
  "laguna ballroom 2": "laguna ballroom",
  "laguna 1": "laguna ballroom",
  "laguna 2": "laguna ballroom",
  "20/20 function room a": "20/20 function room",
  "20/20 function room b": "20/20 function room",
  "20/20 function room c": "20/20 function room",
  "2020 function room a": "20/20 function room",
  "2020 function room b": "20/20 function room",
  "2020 function room c": "20/20 function room",
  "grand ballroom a": "grand ballroom",
  "grand ballroom b": "grand ballroom",
  "grand ballroom c": "grand ballroom",
  "tower 1": "tower ballroom",
  "tower 2": "tower ballroom",
  "tower 3": "tower ballroom",
};

const diningAliases = {
  "hanakazu": "hanakazu japanese restaurant",
  "hanakazu japanese restaurant": "hanakazu japanese restaurant",
  "hanakazujapaneserestaurant": "hanakazu japanese restaurant",
  "qsina": "qsina restaurant",
  "qsina restaurant": "qsina restaurant",
  "qsinarestaurant": "qsina restaurant",
  "phoenix court": "phoenix court",
  "phoenixcourt": "phoenix court",
  "johnnys steak and grill": "johnnys steak and grill",
  "johnnys steak grill": "johnnys steak and grill",
  "johnny steak and grill": "johnnys steak and grill",
  "johnnys": "johnnys steak and grill",
  "johnny": "johnnys steak and grill",
  "pastry corner": "pastry corner",
  "pastrycorner": "pastry corner",
  "vue bar": "vue bar",
  "vuebar": "vue bar",
};

function isArchivedRoom(room) {
  return Boolean(room?.is_archived || room?.metadata?.archived_reason);
}

function knownParentKey(room) {
  const name = canonicalRoomName(room?.name);
  const display = canonicalRoomName(room?.display_name);
  return canonicalParentNames.find((parent) => parent === name || parent === display) || null;
}

function knownChildParentKey(room) {
  const name = canonicalRoomName(room?.name);
  const display = canonicalRoomName(room?.display_name);
  return childParentNameMap[name] || childParentNameMap[display] || null;
}

function diningKey(room) {
  if (room?.type !== "dining") return null;
  const name = canonicalRoomName(room?.name);
  const display = canonicalRoomName(room?.display_name);
  const slug = canonicalRoomName(String(room?.slug || "").replace(/-/g, " "));

  return diningAliases[name] || diningAliases[display] || diningAliases[slug] || name || display || slug || null;
}

function childGroupingKey(room, parentName) {
  const display = canonicalRoomName(room?.display_name);
  const name = canonicalRoomName(room?.name);
  const value = (display || name)
    .replace(parentName, "")
    .replace(/function room|ballroom/g, "")
    .trim();
  return value || name || String(room?.id || "");
}

function uniqueConfiguredRooms(rooms = []) {
  const childCounts = new Map();
  const liveRooms = rooms.filter((room) => !isArchivedRoom(room));

  liveRooms.forEach((room) => {
    if (room.parent_id) {
      childCounts.set(Number(room.parent_id), (childCounts.get(Number(room.parent_id)) || 0) + 1);
    }
  });

  const score = (room) =>
    (childCounts.get(Number(room.id)) || 0) * 10 +
    (room.slug ? 3 : 0) +
    (room.reservation_route ? 2 : 0) +
    (room.show_on_landing ? 1 : 0);

  const byKey = new Map();
  liveRooms.forEach((room) => {
    const nameKey = canonicalRoomName(room.display_name || room.name);
    if (!nameKey) return;
    const diningGroup = diningKey(room);
    const derivedParent = knownChildParentKey(room);
    const parentKey = knownParentKey(room);
    const key = diningGroup
      ? `dining:${diningGroup}`
      : derivedParent
        ? `child:${derivedParent}:${childGroupingKey(room, derivedParent)}`
        : room.parent_id
          ? `child:${room.parent_id}:${nameKey}`
          : `parent:${parentKey || nameKey}`;
    const existing = byKey.get(key);
    if (!existing || score(room) >= score(existing)) {
      byKey.set(key, room);
    }
  });

  return Array.from(byKey.values());
}

function buildEventVenuesFromConfig(rooms = []) {
  const visible = uniqueConfiguredRooms(rooms)
    .filter((room) => room.type === "function_room" && room.is_active && room.is_visible && !isArchivedRoom(room))
    .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0) || String(a.name).localeCompare(String(b.name)));

  const parentKeyById = new Map();
  visible.forEach((room) => {
    if (!room.parent_id && !knownChildParentKey(room)) {
      const key = knownParentKey(room) || canonicalRoomName(room.display_name || room.name);
      parentKeyById.set(Number(room.id), key);
    }
  });

  const byParent = new Map();
  visible.forEach((room) => {
    const parentKey = room.parent_id
      ? parentKeyById.get(Number(room.parent_id))
      : knownChildParentKey(room);

    if (parentKey) {
      byParent.set(parentKey, [...(byParent.get(parentKey) || []), room]);
    }
  });

  return visible
    .filter((room) => !room.parent_id && room.show_on_landing && !knownChildParentKey(room))
    .map((room) => {
      const parentKey = knownParentKey(room) || canonicalRoomName(room.display_name || room.name);
      const children = (byParent.get(parentKey) || [])
        .filter((child) => Number(child.id) !== Number(room.id))
        .filter((child) => child.is_active && child.is_visible && child.reservations_enabled)
        .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
      return {
        title: room.display_name || room.name,
        image: resolveRoomImage(room.image),
        route: roomRoute(room),
        disabled: !(room.is_active && room.is_visible && room.reservations_enabled),
        imageFocus: room.image_position || "center 50%",
        rooms: [], // Do NOT show child/subrooms as selectable links
      };
    });
}

function buildDiningOutletsFromConfig(rooms = []) {
  const configuredDining = uniqueConfiguredRooms(rooms)
    .filter((room) => room.type === "dining" && !room.parent_id && !isArchivedRoom(room))
    .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0) || String(a.name).localeCompare(String(b.name)));

  if (!configuredDining.length) return fallbackDiningOutlets;

  const configuredByKey = new Map();
  configuredDining.forEach((room) => {
    const keys = [
      diningKey(room),
      canonicalRoomName(room.display_name || room.name),
      canonicalRoomName(room.name),
      canonicalRoomName(room.slug),
      canonicalRoomName(String(room.slug || "").replace(/-/g, " ")),
      canonicalRoomName(room.reservation_route),
    ].filter(Boolean);
    keys.forEach((key) => configuredByKey.set(key, room));
  });

  const usedIds = new Set();
  const mappedFallbacks = fallbackDiningOutlets
    .map((outlet) => {
      const outletKey = diningAliases[canonicalRoomName(outlet.title)] || canonicalRoomName(outlet.title);
      const match = configuredByKey.get(outletKey)
        || configuredByKey.get(canonicalRoomName(outlet.title))
        || configuredByKey.get(canonicalRoomName(outlet.route));
      if (!match) return null;
      usedIds.add(match.id);
      if (!match.is_active || !match.is_visible || !match.show_on_landing) return null;
      return {
        title: match.display_name || outlet.title,
        route: match.reservations_enabled ? roomRoute(match) : null,
        disabled: !match.reservations_enabled,
        logo: resolveDiningLogo(match) || outlet.logo,
        mark: match.display_name || outlet.mark,
      };
    })
    .filter(Boolean);

  const configuredExtras = configuredDining
    .filter((room) => !usedIds.has(room.id))
    .filter((room) => room.is_active && room.is_visible && room.show_on_landing)
    .map((room) => ({
      title: room.display_name || room.name,
      route: room.reservations_enabled ? roomRoute(room) : null,
      disabled: !room.reservations_enabled,
      logo: resolveDiningLogo(room),
      mark: room.display_name || room.name,
    }));

  return [...mappedFallbacks, ...configuredExtras];
}

function VenueCard({ item, variant = "event", isInteractive = true }) {
  const navigate = useNavigate();
  const disabled = item.disabled || !item.route || !isInteractive;

  return (
    <article
      className={`reservation-card reservation-card--${variant}${item.rooms?.length ? " reservation-card--has-rooms" : ""}${disabled ? " reservation-card--disabled" : ""}`}
      aria-disabled={disabled}
    >
      {variant === "dining" ? (
        <span className="reservation-card__brand-surface" aria-hidden="true" />
      ) : (
        <>
          <img
            src={item.image}
            alt=""
            aria-hidden="true"
            className="reservation-card__image"
            decoding="async"
            loading="lazy"
            style={item.imageFocus ? { objectPosition: item.imageFocus } : undefined}
            draggable="false"
          />
          <span className="reservation-card__shade" />
        </>
      )}
      <button
        type="button"
        className="reservation-card__hitarea"
        onClick={() => {
          if (!disabled) navigate(item.route);
        }}
        disabled={disabled}
        aria-label={disabled ? `${item.title} is currently unavailable` : `Reserve ${item.title}`}
        tabIndex={disabled ? -1 : 0}
      />

      {variant === "dining" && (
        <div className="reservation-card__brand" aria-hidden="true">
          <span className="reservation-card__logo">
            {item.logo ? (
              <img src={item.logo} alt="" decoding="async" draggable="false" />
            ) : (
              <span>{item.mark}</span>
            )}
          </span>
        </div>
      )}

      {variant !== "dining" && (
        <div className="reservation-card__meta">
          <span className="reservation-card__title">{item.title}</span>

          {item.rooms?.length > 0 && (
            <span className="reservation-card__rooms" aria-label={`${item.title} rooms`}>
              {item.rooms.map((room) => (
                <button
                  key={room.route}
                  type="button"
                  className="reservation-card__room"
                  onClick={() => navigate(room.route)}
                  aria-label={`Reserve ${item.title} ${room.label}`}
                  tabIndex={disabled ? -1 : 0}
                >
                  {room.label}
                </button>
              ))}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

export default function ReservationLanding() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(() => {
    try {
      const s = localStorage.getItem("bellevue-theme");
      if (s !== null) return s;
    } catch {}
    return (window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? true) ? "dark" : "light";
  });
  const [diningOutlets, setDiningOutlets] = useState(fallbackDiningOutlets);
  const [eventVenues, setEventVenues] = useState(null);
  const isLight = theme === "light";

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
    try {
      localStorage.setItem("bellevue-theme", nextTheme);
    } catch {}
  };

  useEffect(() => {
    let mounted = true;
    const loadConfiguredRooms = () => {
      venueAPI.getAll({ _t: Date.now() })
        .then((rooms) => {
          if (!mounted) return;
          const venueRows = Array.isArray(rooms) ? rooms : [];
          setDiningOutlets(buildDiningOutletsFromConfig(venueRows));
          setEventVenues(buildEventVenuesFromConfig(venueRows));
        })
        .catch(() => {
          if (mounted) {
            setDiningOutlets(fallbackDiningOutlets);
            setEventVenues(fallbackEventVenues);
          }
        });
    };

    loadConfiguredRooms();
    const refreshFromAdmin = () => loadConfiguredRooms();
    window.addEventListener("venue-config-updated", refreshFromAdmin);
    window.addEventListener("storage", refreshFromAdmin);

    return () => {
      mounted = false;
      window.removeEventListener("venue-config-updated", refreshFromAdmin);
      window.removeEventListener("storage", refreshFromAdmin);
    };
  }, []);

  return (
    <main className="reservation-launcher" data-theme={theme}>


      <div className="reservation-shell">
        <section className="reservation-hero" aria-label="Bellevue reservation introduction">
          <div className="reservation-hero__content">
            <div
              className="reservation-hero__brand"
              onClick={() => navigate("/")}
              role="button"
              tabIndex={0}
              aria-label="The Bellevue Manila reservation home"
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  navigate("/");
                }
              }}
            >
              <img src={bellevueLogo} alt="" />
            </div>
            <div className="reservation-eyebrow">Concierge Booking</div>
            <h1>
              Seat &amp;
              <br />
              Table
              <br />
              Reservations
            </h1>
            <p>
              A refined reservation gateway for dining outlets, function rooms,
              and signature hotel venues.
            </p>
            <button
              type="button"
              className="reservation-hero__manage"
              onClick={() => navigate("/manage-booking")}
            >
              Manage Existing Booking
            </button>
          </div>

          <div className="reservation-hero__footer">
            <strong>Select a venue to begin.</strong>
            <span>Select a dining outlet or event venue to begin your reservation.</span>
          </div>
        </section>

        <section className="reservation-directory" aria-label="Reservation venues">
          <div className="reservation-section reservation-section--dining">
            <div className="reservation-section__header">
              <div>
                <span className="reservation-section__kicker">Dining Reservation</span>
                <h2>Dining Outlets</h2>
              </div>
              <button
                type="button"
                className="reservation-theme-icon-button"
                onClick={toggleTheme}
                title={isLight ? "Switch to dark mode" : "Switch to light mode"}
                aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
              >
                {isLight ? (
                  <span style={{ fontSize: "18px", lineHeight: 1, display: "block", color: "#a47821", pointerEvents: "none" }} role="presentation">☾</span>
                ) : (
                  <span style={{ fontSize: "18px", lineHeight: 1, display: "block", color: "#e2c96a", pointerEvents: "none" }} role="presentation">☀</span>
                )}
              </button>
            </div>

            <div className="reservation-grid reservation-grid--dining">
              {diningOutlets.map((outlet) => (
                <VenueCard key={outlet.title} item={outlet} variant="dining" />
              ))}
            </div>
          </div>

          <div className="reservation-section reservation-section--events">
            <div className="reservation-section__header">
              <div>
                <span className="reservation-section__kicker">Event Reservation</span>
                <h2>Events &amp; Function Venues</h2>
              </div>
            </div>

            <div className="reservation-grid reservation-grid--events">
              {eventVenues === null ? (
                <div className="reservation-empty-state">
                  <strong>Loading configured venues.</strong>
                  <span>Preparing the current Bellevue function room availability.</span>
                </div>
              ) : eventVenues.length > 0 ? eventVenues.map((venue) => (
                <VenueCard key={venue.title} item={venue} />
              )) : (
                <div className="reservation-empty-state">
                  <strong>No function venues are currently available.</strong>
                  <span>Please check back later or contact The Bellevue Manila for assistance.</span>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>

      <style>{`
        .reservation-launcher {
          --gold: #a47821;
          --gold-soft: #c4a35a;
          --ink: #17130e;
          --cream: #fffaf1;
          --paper: rgba(255, 252, 246, 0.94);
          --paper-strong: rgba(255, 255, 255, 0.98);
          --muted: rgba(74, 60, 39, 0.72);
          --radius-panel: 28px;
          --radius-card: 18px;
          --brand-logo-width: clamp(170px, 15vw, 220px);
          --brand-logo-height: clamp(110px, 10vw, 140px);
          --dining-card-max: 220px;
          min-height: 100vh;
          min-height: 100svh;
          height: 100vh;
          height: 100svh;
          overflow: hidden;
          position: relative;
          isolation: isolate;
          display: grid;
          grid-template-rows: minmax(0, 1fr);
          padding: 16px clamp(18px, 2.5vw, 34px) clamp(16px, 2vw, 26px);
          background-color: #17130f;
          background-image:
            radial-gradient(circle at 14% 10%, rgba(196, 163, 90, 0.13), transparent 28%),
            radial-gradient(circle at 74% 24%, rgba(255, 236, 198, 0.08), transparent 30%),
            radial-gradient(circle at 88% 86%, rgba(255, 250, 241, 0.08), transparent 34%);
          color: var(--cream);
          font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
          box-sizing: border-box;
          font-size: 14px;
          transition: background 0.35s ease, color 0.35s ease;
          animation: reservationSceneIn 0.58s ease both;
        }

        .reservation-launcher[data-theme="light"] {
          background-color: #f2eadf;
          background-image:
            radial-gradient(circle at 14% 12%, rgba(164, 120, 33, 0.11), transparent 30%),
            radial-gradient(circle at 74% 18%, rgba(255, 255, 255, 0.82), transparent 32%),
            radial-gradient(circle at 86% 86%, rgba(216, 189, 120, 0.11), transparent 36%);
          color: var(--ink);
        }

        .reservation-launcher::before {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -2;
          background:
            linear-gradient(90deg, rgba(0,0,0,0.18), transparent 34%),
            radial-gradient(ellipse at 78% 52%, rgba(196, 163, 90, 0.08), transparent 45%);
          opacity: 0.84;
          pointer-events: none;
        }

        .reservation-launcher::after {
          content: "";
          position: absolute;
          inset: 0;
          z-index: -1;
          background-image:
            linear-gradient(120deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 100%),
            radial-gradient(circle at 92% 94%, rgba(255, 250, 241, 0.12), transparent 14%);
          background-size: 140px 140px, auto;
          opacity: 0.16;
          pointer-events: none;
        }

        .reservation-launcher[data-theme="light"]::before {
          background:
            linear-gradient(90deg, rgba(255,255,255,0.52), transparent 42%),
            radial-gradient(ellipse at 80% 48%, rgba(164, 120, 33, 0.08), transparent 48%);
        }

        .reservation-launcher[data-theme="light"]::after {
          opacity: 0.23;
        }

        .reservation-topbar {
          position: relative;
          z-index: 1;
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 18px;
          min-width: 0;
          padding: 7px 10px 7px 12px;
          border: 1px solid rgba(255, 250, 241, 0.1);
          border-radius: 18px;
          background: rgba(18, 15, 11, 0.54);
          box-shadow: 0 14px 32px rgba(18, 12, 7, 0.12);
          backdrop-filter: blur(14px);
          animation: reservationDropIn 0.48s ease 0.08s both;
        }

        .reservation-launcher[data-theme="light"] .reservation-topbar {
          border-color: rgba(164, 120, 33, 0.2);
          background: rgba(255, 252, 246, 0.74);
        }

        .reservation-topbar__nav button {
          font: inherit;
          border: 0;
          background: transparent;
          color: inherit;
        }

        .reservation-topbar__nav button {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.16em;
          text-transform: uppercase;
        }

        .reservation-topbar__nav {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          min-width: 0;
        }

        .reservation-topbar__nav button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 34px;
          padding: 0 13px;
          border: 1px solid rgba(255, 250, 241, 0.12);
          border-radius: 12px;
          color: rgba(255, 250, 241, 0.76);
          cursor: pointer;
          transition: color 0.22s ease, border-color 0.22s ease, background 0.22s ease, transform 0.22s ease;
        }

        .reservation-launcher[data-theme="light"] .reservation-topbar__nav button {
          border-color: rgba(164, 120, 33, 0.16);
          color: rgba(42, 33, 23, 0.72);
        }

        .reservation-topbar__nav button:hover,
        .reservation-topbar__nav button:focus-visible {
          color: var(--cream);
          border-color: rgba(196, 163, 90, 0.52);
          background: rgba(196, 163, 90, 0.14);
          transform: translateY(-1px);
          outline: none;
        }

        .reservation-launcher[data-theme="light"] .reservation-topbar__nav button:hover,
        .reservation-launcher[data-theme="light"] .reservation-topbar__nav button:focus-visible {
          color: #2a2117;
          background: rgba(164, 120, 33, 0.1);
        }

        .reservation-theme-icon-button {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 38px;
          border-radius: 50%;
          border: 1px solid rgba(164, 120, 33, 0.16);
          background: rgba(255, 252, 246, 0.6);
          color: #a47821;
          box-shadow: 0 4px 12px rgba(23, 19, 14, 0.04);
          cursor: pointer;
          transition: all 0.22s cubic-bezier(0.4, 0, 0.2, 1);
          padding: 0;
          outline: none;
          flex-shrink: 0;
        }

        .reservation-launcher[data-theme="dark"] .reservation-theme-icon-button {
          border-color: rgba(255, 250, 241, 0.12);
          background: rgba(30, 26, 22, 0.68);
          color: #e2c96a;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.24);
        }

        .reservation-theme-icon-button:hover,
        .reservation-theme-icon-button:focus-visible {
          border-color: #c4a35a;
          color: #ffffff;
          background: linear-gradient(135deg, #a47821, #c4a35a);
          box-shadow: 0 6px 16px rgba(164, 120, 33, 0.25);
          transform: translateY(-1px);
        }

        .reservation-launcher[data-theme="dark"] .reservation-theme-icon-button:hover,
        .reservation-launcher[data-theme="dark"] .reservation-theme-icon-button:focus-visible {
          border-color: #d8bd78;
          color: #17130e;
          background: linear-gradient(135deg, #c4a35a, #d8bd78);
          box-shadow: 0 6px 16px rgba(196, 163, 90, 0.3);
        }

        .reservation-theme-icon-button:focus-visible {
          outline: 2px solid #c4a35a;
          outline-offset: 2px;
        }

        .reservation-theme-icon-button svg {
          display: block;
          transition: transform 0.25s ease;
        }

        .reservation-shell {
          position: relative;
          z-index: 1;
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(clamp(300px, 27vw, 486px), 0.56fr) minmax(0, 1.44fr);
          gap: clamp(22px, 2.5vw, 42px);
          animation: reservationRiseIn 0.62s ease 0.14s both;
        }

        .reservation-hero {
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 0;
          padding: clamp(30px, 3.2vw, 54px);
          border-radius: var(--radius-panel);
          background: linear-gradient(180deg, rgba(25, 22, 18, 0.98), rgba(12, 10, 8, 0.985));
          border: 1px solid rgba(255, 250, 241, 0.08);
          box-shadow: 0 30px 82px rgba(16, 10, 4, 0.34), inset 0 1px 0 rgba(255, 250, 241, 0.045);
          isolation: isolate;
          animation: reservationPanelIn 0.7s ease 0.18s both;
        }

        .reservation-launcher[data-theme="light"] .reservation-hero {
          color: var(--cream);
          background: linear-gradient(180deg, rgba(28, 25, 21, 0.96), rgba(15, 13, 11, 0.985));
        }

        .reservation-hero::before {
          content: "";
          position: absolute;
          inset: -20% -18%;
          background:
            radial-gradient(circle at 82% 10%, rgba(196, 163, 90, 0.12), transparent 34%),
            radial-gradient(circle at 18% 78%, rgba(255, 250, 241, 0.055), transparent 30%);
          z-index: -1;
        }

        .reservation-hero::after {
          display: none;
        }

        .reservation-hero__content {
          max-width: 420px;
          animation: reservationTextIn 0.68s ease 0.24s both;
        }

        .reservation-hero__brand {
          display: inline-flex;
          align-items: center;
          justify-content: flex-start;
          width: var(--brand-logo-width);
          height: var(--brand-logo-height);
          margin-bottom: clamp(24px, 4vh, 46px);
          margin-left: -14px;
          background: transparent;
          border: none;
          outline: none;
          cursor: pointer;
          transition: opacity 0.22s ease, transform 0.22s ease;
          padding: 0;
          box-sizing: border-box;
        }

        .reservation-hero__brand img {
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: invert(1) hue-rotate(180deg) brightness(1.15) contrast(1.15) drop-shadow(0 8px 16px rgba(0,0,0,0.24));
        }

        .reservation-hero__brand:hover,
        .reservation-hero__brand:focus-visible {
          opacity: 0.88;
          transform: scale(1.02);
          outline: none;
        }

        .reservation-eyebrow {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: clamp(16px, 2vh, 26px);
          color: var(--gold-soft);
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.24em;
          text-transform: uppercase;
        }

        .reservation-eyebrow::before {
          content: "";
          width: 34px;
          height: 1px;
          background: currentColor;
          opacity: 0.9;
        }

        .reservation-hero h1 {
          margin: 0;
          font-family: "Playfair Display", Georgia, serif;
          font-size: clamp(46px, 4vw, 72px);
          line-height: 1;
          letter-spacing: 0;
          font-weight: 600;
          color: #fffaf1;
          text-shadow: 0 18px 42px rgba(0,0,0,0.24);
        }

        .reservation-hero p {
          margin: clamp(18px, 2.4vh, 28px) 0 0;
          max-width: 360px;
          color: rgba(255, 248, 236, 0.86);
          font-size: clamp(14px, 0.9vw, 16px);
          line-height: 1.78;
          font-weight: 450;
        }

        .reservation-hero__manage {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 48px;
          margin-top: clamp(18px, 2.4vh, 26px);
          border: 1px solid #c4a35a;
          border-radius: 14px;
          padding: 0 24px;
          background: linear-gradient(135deg, #a47821, #c4a35a);
          color: #ffffff;
          font: inherit;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.22s ease, color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
          box-shadow: 0 4px 14px rgba(164, 120, 33, 0.25);
        }

        .reservation-hero__manage:hover,
        .reservation-hero__manage:focus-visible {
          background: linear-gradient(135deg, #c4a35a, #d8bd78);
          color: #ffffff;
          box-shadow: 0 8px 24px rgba(164, 120, 33, 0.4);
          transform: translateY(-2px);
          outline: none;
        }

        .reservation-hero__footer {
          display: grid;
          gap: 9px;
          max-width: 410px;
          padding-top: clamp(18px, 2.4vh, 28px);
          border-top: 1px solid rgba(255,255,255,0.13);
          animation: reservationTextIn 0.68s ease 0.34s both;
        }

        .reservation-hero__footer strong {
          font-family: "Playfair Display", Georgia, serif;
          font-size: clamp(18px, 1.35vw, 23px);
          font-weight: 620;
          color: #fffaf1;
        }

        .reservation-hero__footer span {
          max-width: 350px;
          color: rgba(255, 248, 236, 0.82);
          font-size: 12.5px;
          line-height: 1.68;
        }

        .reservation-directory {
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          gap: clamp(26px, 3vh, 40px);
          padding: clamp(20px, 3.8vw, 54px) clamp(20px, 3.8vw, 54px) clamp(18px, 2.2vw, 32px);
          container-type: inline-size;
          border-radius: var(--radius-panel);
          background: rgba(255, 252, 246, 0.34);
          border: 1px solid rgba(164, 120, 33, 0.09);
          box-shadow: none;
          backdrop-filter: blur(10px);
          color: var(--ink);
          animation: reservationPanelIn 0.7s ease 0.24s both;
        }

        .reservation-launcher[data-theme="dark"] .reservation-directory {
          background: rgba(12, 10, 8, 0.28);
          color: var(--cream);
          border-color: rgba(255, 250, 241, 0.055);
          box-shadow: none;
        }

        .reservation-section {
          min-height: 0;
        }

        .reservation-section--events {
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
        }

        .reservation-section--dining {
          min-width: 0;
        }

        .reservation-section__header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: clamp(12px, 1.3vw, 18px);
        }

        .reservation-section__kicker {
          color: var(--muted);
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .reservation-section__kicker {
          display: block;
          margin-bottom: 4px;
          color: var(--gold);
        }

        .reservation-section__header h2 {
          margin: 0;
          font-family: "Playfair Display", Georgia, serif;
          font-size: clamp(26px, 2.1vw, 40px);
          line-height: 1.03;
          font-weight: 620;
          letter-spacing: 0;
          color: var(--ink);
        }

        .reservation-launcher[data-theme="dark"] .reservation-section__header h2 {
          color: var(--cream);
        }

        .reservation-grid {
          display: grid;
          gap: clamp(14px, 1.25vw, 24px);
        }

        .reservation-grid--dining {
          grid-template-columns: repeat(6, minmax(0, 1fr));
          justify-content: start;
          align-items: start;
        }

        .reservation-grid--events {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          grid-auto-rows: clamp(170px, 15vh, 220px);
          min-height: 0;
        }

        .reservation-card {
          position: relative;
          overflow: hidden;
          display: block;
          width: 100%;
          min-width: 0;
          border: 0;
          border-radius: var(--radius-card);
          padding: 0;
          background: #17130e;
          text-align: left;
          box-shadow: 0 16px 34px rgba(23, 19, 14, 0.16), inset 0 0 0 1px rgba(255, 250, 241, 0.035);
          opacity: 0;
          transform: translateY(12px);
          animation: reservationCardIn 0.52s ease both;
          transition: transform 0.26s ease, box-shadow 0.26s ease, filter 0.26s ease;
        }

        .reservation-card:nth-child(1) { animation-delay: 0.3s; }
        .reservation-card:nth-child(2) { animation-delay: 0.36s; }
        .reservation-card:nth-child(3) { animation-delay: 0.42s; }
        .reservation-card:nth-child(4) { animation-delay: 0.48s; }
        .reservation-card:nth-child(5) { animation-delay: 0.54s; }
        .reservation-card:nth-child(6) { animation-delay: 0.6s; }

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
        }

        .reservation-launcher[data-theme="light"] .reservation-card--dining {
          background:
            radial-gradient(circle at 52% 34%, rgba(164, 120, 33, 0.10), transparent 54%),
            linear-gradient(180deg, rgba(255, 255, 255, 0.74), rgba(255, 250, 241, 0.62)),
            rgba(255, 252, 246, 0.92);
          border-color: rgba(164, 120, 33, 0.13);
          box-shadow: 0 18px 38px rgba(42, 31, 18, 0.11), inset 0 0 0 1px rgba(255, 255, 255, 0.72);
        }

        .reservation-empty-state {
          min-height: 126px;
          grid-column: 1 / -1;
          display: grid;
          align-content: center;
          gap: 7px;
          padding: 22px;
          border: 1px solid rgba(196, 163, 90, 0.18);
          border-radius: var(--radius-card);
          background: rgba(255, 250, 241, 0.055);
          color: rgba(255, 250, 241, 0.78);
        }

        .reservation-launcher[data-theme="light"] .reservation-empty-state {
          background: rgba(255, 255, 255, 0.52);
          color: rgba(42, 33, 23, 0.72);
        }

        .reservation-empty-state strong {
          font-size: 14px;
          font-weight: 680;
          color: inherit;
        }

        .reservation-empty-state span {
          font-size: 12px;
          line-height: 1.55;
          color: inherit;
          opacity: 0.78;
        }

        .reservation-card__image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          filter: saturate(1.02) contrast(1.015) brightness(0.99);
          transform: translateZ(0) scale(1.001);
          transition: transform 0.42s ease, filter 0.42s ease;
          will-change: transform;
          backface-visibility: hidden;
        }

        .reservation-card__shade {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(0,0,0,0.02), rgba(0,0,0,0.7)),
            radial-gradient(circle at 24% 18%, rgba(255, 232, 182, 0.13), transparent 36%),
            linear-gradient(90deg, rgba(0,0,0,0.36), transparent 68%);
          transition: opacity 0.28s ease, background 0.28s ease;
        }

        .reservation-card__brand-surface {
          position: absolute;
          inset: 0;
          background:
            linear-gradient(180deg, rgba(255, 250, 241, 0.035), transparent 42%),
            radial-gradient(circle at 50% 50%, rgba(255, 250, 241, 0.055), transparent 56%),
            linear-gradient(0deg, rgba(0, 0, 0, 0.13), transparent 38%);
          opacity: 0.42;
          transition: opacity 0.26s ease;
        }

        .reservation-launcher[data-theme="light"] .reservation-card__brand-surface {
          background:
            linear-gradient(180deg, rgba(164, 120, 33, 0.03), transparent 42%),
            radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.34), transparent 58%),
            linear-gradient(0deg, rgba(42, 31, 18, 0.06), transparent 38%);
        }

        .reservation-card--event .reservation-card__image {
          filter: saturate(1.04) contrast(1.035) brightness(0.99);
        }

        .reservation-card--event .reservation-card__shade {
          background:
            linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.62)),
            radial-gradient(circle at 22% 14%, rgba(255, 232, 182, 0.12), transparent 34%),
            linear-gradient(90deg, rgba(0,0,0,0.3), transparent 66%);
        }

        .reservation-card__hitarea {
          position: absolute;
          inset: 0;
          z-index: 2;
          border: 0;
          padding: 0;
          background: transparent;
          cursor: pointer;
        }

        .reservation-card__hitarea:disabled {
          cursor: not-allowed;
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
          border-radius: 0;
          background: transparent;
          color: #c4a35a;
          box-shadow: none;
          overflow: visible;
        }

        .reservation-card__logo img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center;
          filter: none;
          image-rendering: auto;
          transform: translateZ(0) scale(1);
          backface-visibility: hidden;
          transition: transform 0.28s ease, filter 0.28s ease;
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
          gap: 12px;
          min-width: 0;
          pointer-events: none;
        }

        .reservation-card__title {
          min-width: 0;
          font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
          font-size: clamp(16px, 1.02vw, 21px);
          line-height: 1.05;
          color: #fffaf1;
          font-weight: 740;
          letter-spacing: 0;
          text-shadow: 0 3px 18px rgba(0, 0, 0, 0.76);
        }

        .reservation-card--dining .reservation-card__title {
          color: #fffaf1;
          font-size: clamp(15px, 0.98vw, 19px);
          font-weight: 720;
          text-shadow: none;
        }

        .reservation-launcher[data-theme="light"] .reservation-card--dining .reservation-card__title {
          color: #1f1710;
        }

        .reservation-card--event .reservation-card__title {
          font-size: clamp(15px, 0.92vw, 19px);
          max-width: none;
        }

        .reservation-card__rooms {
          display: inline-flex;
          flex: 0 0 auto;
          align-items: center;
          gap: 5px;
          pointer-events: auto;
        }

        .reservation-card__room {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 23px;
          height: 23px;
          border: 0;
          border-radius: 8px;
          background: rgba(14, 11, 8, 0.5);
          color: #fffaf1;
          font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
          font-size: 9px;
          font-weight: 760;
          line-height: 1;
          box-shadow: 0 7px 16px rgba(0,0,0,0.26), inset 0 0 0 1px rgba(255, 250, 241, 0.16);
          backdrop-filter: blur(10px);
          transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
          cursor: pointer;
        }

        .reservation-card::after {
          content: "Reserve";
          position: absolute;
          top: 12px;
          right: 12px;
          z-index: 3;
          padding: 6px 9px;
          border: 1px solid rgba(255, 250, 241, 0.2);
          border-radius: 9px;
          background: rgba(14, 11, 8, 0.42);
          color: rgba(255, 250, 241, 0.84);
          font-size: 9px;
          font-weight: 720;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          opacity: 0;
          transform: translateY(-5px);
          transition: opacity 0.22s ease, transform 0.22s ease;
          pointer-events: none;
        }

        .reservation-card--has-rooms::after {
          display: none;
        }

        .reservation-card--dining::after {
          display: none;
        }

        .reservation-card--disabled {
          opacity: 0.58;
        }

        .reservation-card--disabled::after {
          content: "Unavailable";
          opacity: 1;
          transform: translateY(0);
        }

        .reservation-card:hover,
        .reservation-card:focus-within {
          transform: translateY(-3px);
          box-shadow: 0 24px 50px rgba(23, 19, 14, 0.24), inset 0 0 0 1px rgba(196, 163, 90, 0.16);
          outline: none;
        }

        .reservation-card--dining:hover,
        .reservation-card--dining:focus-within {
          transform: translateY(-4px);
          box-shadow: 0 24px 54px rgba(10, 8, 6, 0.30), 0 0 0 1px rgba(196, 163, 90, 0.2), inset 0 0 0 1px rgba(255, 250, 241, 0.08);
        }

        .reservation-launcher[data-theme="light"] .reservation-card--dining:hover,
        .reservation-launcher[data-theme="light"] .reservation-card--dining:focus-within {
          box-shadow: 0 22px 46px rgba(42, 31, 18, 0.16), 0 0 0 1px rgba(164, 120, 33, 0.16), inset 0 0 0 1px rgba(255, 255, 255, 0.72);
        }

        .reservation-card:hover::after,
        .reservation-card:focus-within::after {
          opacity: 1;
          transform: translateY(0);
        }

        .reservation-card:hover .reservation-card__image,
        .reservation-card:focus-within .reservation-card__image {
          transform: translateZ(0) scale(1.018);
          filter: saturate(1.05) contrast(1.025) brightness(1);
        }

        .reservation-card--dining:hover .reservation-card__brand-surface,
        .reservation-card--dining:focus-within .reservation-card__brand-surface {
          opacity: 1;
        }

        .reservation-card--dining:hover .reservation-card__logo img,
        .reservation-card--dining:focus-within .reservation-card__logo img {
          transform: translateZ(0) scale(1.018);
          filter: saturate(1.035) contrast(1.02);
        }

        .reservation-card:hover .reservation-card__shade,
        .reservation-card:focus-within .reservation-card__shade {
          opacity: 0.9;
          background:
            linear-gradient(180deg, rgba(0,0,0,0.03), rgba(0,0,0,0.78)),
            radial-gradient(circle at 22% 18%, rgba(255, 232, 182, 0.18), transparent 38%),
            linear-gradient(90deg, rgba(0,0,0,0.4), transparent 68%);
        }

        .reservation-card--event:hover .reservation-card__image,
        .reservation-card--event:focus-within .reservation-card__image {
          transform: translateZ(0) scale(1.014);
          filter: saturate(1.07) contrast(1.045) brightness(1);
        }

        .reservation-card--event:hover .reservation-card__shade,
        .reservation-card--event:focus-within .reservation-card__shade {
          opacity: 0.94;
          background:
            linear-gradient(180deg, rgba(0,0,0,0.04), rgba(0,0,0,0.68)),
            radial-gradient(circle at 22% 14%, rgba(255, 232, 182, 0.16), transparent 36%),
            linear-gradient(90deg, rgba(0,0,0,0.34), transparent 68%);
        }

        .reservation-card--disabled:hover,
        .reservation-card--disabled:focus-within {
          transform: none;
          box-shadow: inset 0 0 0 1px rgba(196, 163, 90, 0.08);
        }

        .reservation-card--disabled:hover .reservation-card__image,
        .reservation-card--disabled:focus-within .reservation-card__image,
        .reservation-card--disabled:hover .reservation-card__logo img,
        .reservation-card--disabled:focus-within .reservation-card__logo img {
          transform: translateZ(0) scale(1);
        }

        .reservation-card__hitarea:focus-visible {
          outline: 2px solid rgba(196, 163, 90, 0.82);
          outline-offset: -6px;
          border-radius: var(--radius-card);
        }

        .reservation-card__room:hover,
        .reservation-card__room:focus-visible {
          background: #c4a35a;
          color: #17130e;
          transform: translateY(-1px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.32);
          outline: none;
        }

        @keyframes reservationSceneIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes reservationDropIn {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes reservationRiseIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes reservationPanelIn {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.992);
            filter: blur(4px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes reservationTextIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes reservationCardIn {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-height: 840px) and (min-width: 981px) {
          .reservation-launcher {
            --brand-logo-width: 180px;
            --brand-logo-height: 115px;
            --dining-card-max: 196px;
            grid-template-rows: minmax(0, 1fr);
            padding: 10px 22px 12px;
          }

          .reservation-topbar {
            padding-top: 5px;
            padding-bottom: 5px;
          }

          .reservation-hero {
            padding: 24px 30px;
          }

          .reservation-hero h1 {
            font-size: clamp(40px, 3.45vw, 56px);
          }

          .reservation-hero p {
            margin-top: 16px;
            line-height: 1.6;
          }

          .reservation-directory {
            padding: clamp(22px, 3.2vw, 42px) clamp(22px, 3.2vw, 42px) 18px;
            gap: 22px;
          }

          .reservation-section__header h2 {
            font-size: clamp(22px, 1.65vw, 30px);
          }

          .reservation-grid {
            gap: 10px;
          }
        }

        @media (max-width: 1280px) {
          .reservation-launcher {
            --dining-card-max: 204px;
          }

          .reservation-shell {
            grid-template-columns: minmax(clamp(270px, 30vw, 410px), 0.66fr) minmax(0, 1.34fr);
            gap: 22px;
          }

          .reservation-directory {
            padding: clamp(18px, 2.8vw, 34px) clamp(18px, 2.8vw, 34px) 18px;
          }
        }

        @media (max-width: 980px) {
          .reservation-launcher {
            --brand-logo-width: 190px;
            --brand-logo-height: 120px;
            --dining-card-max: 210px;
            height: auto;
            min-height: 100vh;
            min-height: 100svh;
            overflow: auto;
            grid-template-rows: auto;
            background-color: #18140f;
            background-image:
              radial-gradient(circle at 12% 8%, rgba(196, 163, 90, 0.09), transparent 28%),
              radial-gradient(circle at 88% 92%, rgba(255, 250, 241, 0.09), transparent 34%);
          }

          .reservation-shell {
            grid-template-columns: 1fr;
          }

          .reservation-hero {
            min-height: 420px;
          }

          .reservation-grid--dining,
          .reservation-grid--events {
            height: auto;
          }

          .reservation-grid--dining {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }

          .reservation-grid--events {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .reservation-card--event {
            aspect-ratio: 1.7 / 1;
          }
        }

        @media (max-width: 720px) {
          .reservation-launcher {
            --radius-panel: 18px;
            --radius-card: 12px;
            --brand-logo-width: 150px;
            --brand-logo-height: 100px;
            --dining-card-max: 1fr;
            padding: 12px;
            gap: 12px;
          }

          .reservation-section--dining .reservation-section__header {
            flex-direction: row;
            align-items: flex-start;
            justify-content: space-between;
          }

          .reservation-topbar {
            align-items: center;
            justify-content: flex-end;
            border-radius: 16px;
            flex-direction: row;
            padding: 12px;
          }

          .reservation-topbar__nav {
            width: auto;
            flex-wrap: wrap;
          }

          .reservation-topbar__nav button {
            flex: 0 0 auto;
            min-width: 58px;
          }

          .reservation-hero,
          .reservation-directory {
            border-radius: var(--radius-panel);
          }

          .reservation-hero {
            min-height: 390px;
            padding: 24px;
          }

          .reservation-hero h1 {
            font-size: 42px;
          }

          .reservation-section__header {
            align-items: flex-start;
            flex-direction: column;
            gap: 7px;
          }

          .reservation-grid--dining,
          .reservation-grid--events {
            grid-template-columns: 1fr;
          }

          .reservation-card--event {
            aspect-ratio: 1.62 / 1;
          }

          .reservation-grid--dining {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .reservation-card--dining {
            aspect-ratio: 4 / 3;
          }
        }

        @media (max-width: 460px) {
          .reservation-launcher {
            padding: 10px;
          }

          .reservation-directory {
            padding: 14px;
          }

          .reservation-card__title {
            font-size: clamp(14px, 4.4vw, 18px);
          }

          .reservation-card__meta {
            left: 12px;
            right: 12px;
            bottom: 12px;
          }

          .reservation-card__room {
            width: 21px;
            height: 21px;
          }
        }
      `}</style>
    </main>
  );
}

