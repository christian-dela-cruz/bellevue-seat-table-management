import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import bellevueLogo from "../../../assets/bellevue-logo.png";
import hanakazuImg from "../../../assets/hanakazu-dining-hires.jpg";
import qsinaImg from "../../../assets/qsina-dining-hires.jpg";
import phoenixCourtImg from "../../../assets/phoenix-court-dining-hires.webp";
import hanakazuLogo from "../../../assets/hanakazu-logo-enhanced.png";
import qsinaLogo from "../../../assets/qsina-logo-enhanced.png";
import phoenixCourtLogo from "../../../assets/phoenix-court-logo-enhanced.png";
import alabangImg from "../../../assets/alabang-function-hires.jpg";
import lagunaImg from "../../../assets/laguna-ballroom-hires.jpg";
import twentyTwentyImg from "../../../assets/twenty-twenty-function-hires.jpg";
import grandBallroomImg from "../../../assets/grand-ballroom-hires.jpg";
import towerBallroomImg from "../../../assets/tower-ballroom-hires.jpg";
import businessCenterImg from "../../../assets/business-center-hires.jpg";
import { venueAPI } from "../../../services/venueAPI";

const diningOutlets = [
  {
    title: "Hanakazu",
    image: hanakazuImg,
    route: "/hanakazu",
    logo: hanakazuLogo,
    mark: "Hanakazu",
  },
  {
    title: "Qsina",
    image: qsinaImg,
    route: "/qsina",
    logo: qsinaLogo,
    mark: "Qsina",
  },
  {
    title: "Phoenix Court",
    image: phoenixCourtImg,
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
};

function resolveRoomImage(image) {
  if (!image) return businessCenterImg;
  if (/^(https?:|data:|blob:)/i.test(image)) return image;
  const key = String(image).split("/").pop();
  if (roomImageMap[key]) return roomImageMap[key];
  const apiRoot = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api").replace(/\/api\/?$/, "");
  if (String(image).startsWith("/")) return `${apiRoot}${image}`;
  if (String(image).includes("/")) return `${apiRoot}/${String(image).replace(/^\/+/, "")}`;
  return `${apiRoot}/images/${image}`;
}

function roomRoute(room) {
  return room?.reservation_route || roomRouteMap[String(room?.name || "").toLowerCase()] || "/venues";
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

function uniqueConfiguredRooms(rooms = []) {
  const childCounts = new Map();
  rooms.forEach((room) => {
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
  rooms.forEach((room) => {
    const nameKey = canonicalRoomName(room.display_name || room.name);
    if (!nameKey) return;
    const key = room.parent_id
      ? `child:${room.parent_id}:${nameKey}`
      : `parent:${nameKey}`;
    const existing = byKey.get(key);
    if (!existing || score(room) >= score(existing)) {
      byKey.set(key, room);
    }
  });

  return Array.from(byKey.values());
}

function buildEventVenuesFromConfig(rooms = []) {
  const visible = uniqueConfiguredRooms(rooms)
    .filter((room) => room.type === "function_room" && room.is_active && room.is_visible)
    .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0) || String(a.name).localeCompare(String(b.name)));
  const byParent = new Map();
  visible.forEach((room) => {
    if (room.parent_id) {
      byParent.set(Number(room.parent_id), [...(byParent.get(Number(room.parent_id)) || []), room]);
    }
  });

  return visible
    .filter((room) => !room.parent_id && room.show_on_landing)
    .map((room) => {
      const children = (byParent.get(Number(room.id)) || [])
        .filter((child) => child.is_active && child.is_visible && child.reservations_enabled)
        .sort((a, b) => Number(a.display_order || 0) - Number(b.display_order || 0));
      return {
        title: room.display_name || room.name,
        image: resolveRoomImage(room.image),
        route: room.parent_selectable && room.reservations_enabled ? roomRoute(room) : roomRoute(children[0] || room),
        imageFocus: room.image_position || "center 50%",
        rooms: children.map((child) => ({
          label: childLabel(child, room.name),
          route: roomRoute(child),
        })),
      };
    });
}

function VenueCard({ item, variant = "event", isInteractive = true }) {
  const navigate = useNavigate();

  return (
    <article
      className={`reservation-card reservation-card--${variant}${item.rooms?.length ? " reservation-card--has-rooms" : ""}`}
    >
      <img
        src={item.image}
        alt=""
        aria-hidden="true"
        className="reservation-card__image"
        decoding="async"
        loading={variant === "dining" ? "eager" : "lazy"}
        style={item.imageFocus ? { objectPosition: item.imageFocus } : undefined}
        draggable="false"
      />
      <span className="reservation-card__shade" />
      <button
        type="button"
        className="reservation-card__hitarea"
        onClick={() => navigate(item.route)}
        aria-label={`Reserve ${item.title}`}
        tabIndex={isInteractive ? 0 : -1}
      />

      {variant === "dining" && (
        <span className="reservation-card__logo" aria-hidden="true">
          {item.logo ? (
            <img src={item.logo} alt="" decoding="async" draggable="false" />
          ) : (
            <span>{item.mark}</span>
          )}
        </span>
      )}

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
                tabIndex={isInteractive ? 0 : -1}
              >
                {room.label}
              </button>
            ))}
          </span>
        )}
      </div>
    </article>
  );
}

function DiningCarousel({ items }) {
  const viewportRef = useRef(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [metrics, setMetrics] = useState({
    cardWidth: 470,
    gap: 18,
    viewportWidth: 1030,
    cardRatio: 1.78,
  });
  const slideStep = metrics.cardWidth + metrics.gap;
  const centeredOffset = (metrics.viewportWidth - metrics.cardWidth) / 2;
  const trackHeight = metrics.cardWidth / metrics.cardRatio;
  const itemCount = items.length;

  useEffect(() => {
    const updateMetrics = () => {
      const viewport = viewportRef.current;
      const width = viewport?.clientWidth || 0;
      if (!width) return;

      const viewportWidth = window.innerWidth;
      const compactHeight = window.innerHeight <= 760;
      const visibleCards = viewportWidth <= 720 ? 1.08 : viewportWidth <= 980 ? 1.48 : compactHeight ? 2.22 : 2.08;
      const gap = viewportWidth <= 720 ? 12 : viewportWidth <= 980 ? 16 : 18;
      const minimumWidth = viewportWidth <= 720 ? 260 : viewportWidth <= 980 ? 340 : 420;
      const cardWidth = Math.max(minimumWidth, (width - gap * (visibleCards - 1)) / visibleCards);
      const cardRatio = viewportWidth <= 720 ? 1.62 : viewportWidth <= 980 ? 1.7 : 1.78;

      setMetrics({ cardWidth, gap, viewportWidth: width, cardRatio });
    };

    updateMetrics();
    const resizeObserver = window.ResizeObserver && viewportRef.current ? new ResizeObserver(updateMetrics) : null;
    if (viewportRef.current && resizeObserver) {
      resizeObserver.observe(viewportRef.current);
    }

    window.addEventListener("resize", updateMetrics);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateMetrics);
    };
  }, []);

  const moveCarousel = (direction) => {
    setActiveIndex((current) => (current + direction + itemCount) % itemCount);
  };

  const circularOffset = (index) => {
    let offset = index - activeIndex;
    const midpoint = itemCount / 2;
    if (offset > midpoint) offset -= itemCount;
    if (offset < -midpoint) offset += itemCount;
    return offset;
  };

  return (
    <div className="reservation-carousel" role="region" aria-roledescription="carousel" aria-label="Dining outlets carousel">
      <button
        type="button"
        className="reservation-carousel__control reservation-carousel__control--prev"
        onClick={() => moveCarousel(-1)}
        aria-label="Show previous dining outlet"
      >
        <span aria-hidden="true">&lsaquo;</span>
      </button>

      <div className="reservation-carousel__viewport" ref={viewportRef}>
        <div
          className="reservation-carousel__track"
          style={{ height: `${trackHeight}px` }}
        >
          {items.map((outlet, index) => {
            const offsetFromActive = circularOffset(index);
            const distanceFromActive = Math.abs(offsetFromActive);
            const slideState =
              distanceFromActive === 0
                ? "is-active"
                : distanceFromActive === 1
                  ? `is-near ${offsetFromActive < 0 ? "is-before" : "is-after"}`
                  : "is-dimmed";
            const isVisibleSlide = distanceFromActive <= 2;
            const isInteractiveSlide = distanceFromActive <= 1;

            return (
              <div
                className={`reservation-carousel__slide ${slideState}`}
                key={outlet.title}
                style={{
                  width: `${metrics.cardWidth}px`,
                  "--slide-x": `${centeredOffset + offsetFromActive * slideStep}px`,
                }}
                aria-hidden={!isVisibleSlide}
              >
                <VenueCard item={outlet} variant="dining" isInteractive={isInteractiveSlide} />
              </div>
            );
          })}
        </div>
      </div>

      <button
        type="button"
        className="reservation-carousel__control reservation-carousel__control--next"
        onClick={() => moveCarousel(1)}
        aria-label="Show next dining outlet"
      >
        <span aria-hidden="true">&rsaquo;</span>
      </button>
    </div>
  );
}

export default function ReservationLanding() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState("dark");
  const [eventVenues, setEventVenues] = useState(fallbackEventVenues);
  const isLight = theme === "light";

  useEffect(() => {
    let mounted = true;
    venueAPI.getAll({ type: "function_room", active: true, visible: true })
      .then((rooms) => {
        if (!mounted) return;
        const configured = buildEventVenuesFromConfig(Array.isArray(rooms) ? rooms : []);
        setEventVenues(configured.length ? configured : fallbackEventVenues);
      })
      .catch(() => {
        if (mounted) setEventVenues(fallbackEventVenues);
      });
    return () => { mounted = false; };
  }, []);

  return (
    <main className="reservation-launcher" data-theme={theme}>
      <header className="reservation-topbar">
        <nav className="reservation-topbar__nav" aria-label="Reservation quick navigation">
          <button
            type="button"
            className="reservation-theme-toggle"
            onClick={() => setTheme(isLight ? "dark" : "light")}
            aria-pressed={isLight}
            aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
          >
            <span className="reservation-theme-toggle__switch" aria-hidden="true">
              <span className="reservation-theme-toggle__icon reservation-theme-toggle__icon--moon">
                <svg viewBox="0 0 24 24" role="presentation">
                  <path d="M20.3 15.4A7.8 7.8 0 0 1 8.6 3.7a8.2 8.2 0 1 0 11.7 11.7Z" />
                </svg>
              </span>
              <span className="reservation-theme-toggle__icon reservation-theme-toggle__icon--sun">
                <svg viewBox="0 0 24 24" role="presentation">
                  <circle cx="12" cy="12" r="4.2" />
                  <path d="M12 2.8v2.1M12 19.1v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
                </svg>
              </span>
              <span className="reservation-theme-toggle__thumb">
                {isLight ? (
                  <svg viewBox="0 0 24 24" role="presentation">
                    <circle cx="12" cy="12" r="4.2" />
                    <path d="M12 2.8v2.1M12 19.1v2.1M4.9 4.9l1.5 1.5M17.6 17.6l1.5 1.5M2.8 12h2.1M19.1 12h2.1M4.9 19.1l1.5-1.5M17.6 6.4l1.5-1.5" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" role="presentation">
                    <path d="M20.3 15.4A7.8 7.8 0 0 1 8.6 3.7a8.2 8.2 0 1 0 11.7 11.7Z" />
                  </svg>
                )}
              </span>
            </span>
          </button>
        </nav>
      </header>

      <div className="reservation-shell">
        <section className="reservation-hero" aria-label="Bellevue reservation introduction">
          <div className="reservation-hero__content">
            <button
              type="button"
              className="reservation-hero__brand"
              onClick={() => navigate("/")}
              aria-label="The Bellevue Manila reservation home"
            >
              <img src={bellevueLogo} alt="" />
            </button>
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
            </div>

            <DiningCarousel items={diningOutlets} />
          </div>

          <div className="reservation-section reservation-section--events">
            <div className="reservation-section__header">
              <div>
                <span className="reservation-section__kicker">Event Reservation</span>
                <h2>Events &amp; Function Venues</h2>
              </div>
            </div>

            <div className="reservation-grid reservation-grid--events">
              {eventVenues.map((venue) => (
                <VenueCard key={venue.title} item={venue} />
              ))}
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
          --muted: rgba(74, 60, 39, 0.68);
          --radius-panel: 22px;
          --radius-card: 14px;
          --brand-logo-size: clamp(46px, 4vw, 58px);
          --brand-mark-size: clamp(34px, 3.05vw, 42px);
          --outlet-logo-size: clamp(52px, 4.35vw, 74px);
          min-height: 100vh;
          min-height: 100svh;
          height: 100vh;
          height: 100svh;
          overflow: hidden;
          display: grid;
          grid-template-rows: 52px minmax(0, 1fr);
          gap: 14px;
          padding: 16px clamp(18px, 2.5vw, 34px) clamp(16px, 2vw, 26px);
          background:
            radial-gradient(circle at 11% 10%, rgba(196, 163, 90, 0.16), transparent 28%),
            linear-gradient(116deg, #21180f 0%, #14110d 33.4%, #ece4d4 33.6%, #fbf7ef 100%);
          color: var(--cream);
          font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
          box-sizing: border-box;
          font-size: 14px;
          transition: background 0.35s ease, color 0.35s ease;
          animation: reservationSceneIn 0.58s ease both;
        }

        .reservation-launcher[data-theme="light"] {
          background:
            radial-gradient(circle at 8% 10%, rgba(196, 163, 90, 0.14), transparent 30%),
            linear-gradient(116deg, #f8f1e6 0%, #efe2cf 33.4%, #fffaf1 33.6%, #ffffff 100%);
          color: var(--ink);
        }

        .reservation-topbar {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 18px;
          min-width: 0;
          padding: 7px 10px 7px 12px;
          border: 1px solid rgba(255, 250, 241, 0.1);
          border-radius: 18px;
          background: rgba(17, 13, 9, 0.38);
          box-shadow: 0 18px 38px rgba(18, 12, 7, 0.12);
          backdrop-filter: blur(18px);
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

        .reservation-theme-toggle {
          gap: 0;
          justify-content: center;
          min-width: 58px;
          padding: 0 6px !important;
        }

        .reservation-theme-toggle__switch {
          position: relative;
          display: inline-flex;
          align-items: center;
          justify-content: space-between;
          width: 46px;
          height: 24px;
          padding: 3px 5px;
          border-radius: 999px;
          background:
            linear-gradient(135deg, rgba(255, 250, 241, 0.18), rgba(196, 163, 90, 0.14)),
            rgba(10, 8, 6, 0.24);
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.13);
          overflow: hidden;
        }

        .reservation-theme-toggle__icon,
        .reservation-theme-toggle__thumb {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .reservation-theme-toggle__icon {
          width: 14px;
          height: 14px;
          color: rgba(255, 250, 241, 0.42);
          transition: color 0.26s ease, opacity 0.26s ease, transform 0.26s ease;
        }

        .reservation-theme-toggle__icon svg,
        .reservation-theme-toggle__thumb svg {
          width: 100%;
          height: 100%;
          fill: none;
          stroke: currentColor;
          stroke-width: 1.9;
          stroke-linecap: round;
          stroke-linejoin: round;
        }

        .reservation-theme-toggle__icon--moon svg,
        .reservation-theme-toggle__thumb svg path:first-child:last-child {
          fill: currentColor;
          stroke: none;
        }

        .reservation-theme-toggle__thumb {
          position: absolute;
          top: 3px;
          left: 3px;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #d8bd78, #a47821);
          color: #17130e;
          padding: 4px;
          transition: transform 0.32s cubic-bezier(0.22, 1, 0.36, 1), background 0.28s ease, color 0.28s ease, box-shadow 0.28s ease;
          box-shadow: 0 3px 9px rgba(0,0,0,0.24);
          z-index: 2;
        }

        .reservation-theme-toggle[aria-pressed="false"] .reservation-theme-toggle__icon--moon,
        .reservation-theme-toggle[aria-pressed="true"] .reservation-theme-toggle__icon--sun {
          color: rgba(255, 250, 241, 0.72);
          transform: scale(1.04);
        }

        .reservation-theme-toggle[aria-pressed="true"] .reservation-theme-toggle__thumb {
          transform: translateX(22px);
          background: linear-gradient(135deg, #fffaf1, #d8bd78);
          color: #8a621c;
        }

        .reservation-launcher[data-theme="light"] .reservation-theme-toggle__switch {
          background:
            linear-gradient(135deg, rgba(164, 120, 33, 0.10), rgba(255, 255, 255, 0.62)),
            rgba(255, 252, 246, 0.82);
          box-shadow: inset 0 0 0 1px rgba(164,120,33,0.16);
        }

        .reservation-launcher[data-theme="light"] .reservation-theme-toggle__icon {
          color: rgba(74, 60, 39, 0.34);
        }

        .reservation-theme-toggle:hover .reservation-theme-toggle__switch,
        .reservation-theme-toggle:focus-visible .reservation-theme-toggle__switch {
          box-shadow: inset 0 0 0 1px rgba(196, 163, 90, 0.32), 0 6px 16px rgba(0,0,0,0.10);
        }

        .reservation-shell {
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(clamp(280px, 32vw, 430px), 0.68fr) minmax(0, 1.42fr);
          gap: clamp(18px, 2vw, 32px);
          animation: reservationRiseIn 0.62s ease 0.14s both;
        }

        .reservation-hero {
          position: relative;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 0;
          padding: clamp(26px, 3.2vw, 44px);
          border-radius: var(--radius-panel);
          background:
            linear-gradient(119deg, rgba(16, 13, 10, 0.98), rgba(16, 13, 10, 0.92) 56%, rgba(70, 54, 28, 0.68)),
            radial-gradient(circle at 86% 12%, rgba(196, 163, 90, 0.24), transparent 34%);
          box-shadow: 0 28px 90px rgba(16, 10, 4, 0.38);
          isolation: isolate;
          animation: reservationPanelIn 0.7s ease 0.18s both;
        }

        .reservation-launcher[data-theme="light"] .reservation-hero {
          color: var(--cream);
          background:
            linear-gradient(119deg, rgba(25, 19, 13, 0.95), rgba(25, 19, 13, 0.88) 56%, rgba(116, 87, 40, 0.58)),
            radial-gradient(circle at 86% 12%, rgba(196, 163, 90, 0.26), transparent 34%);
        }

        .reservation-hero::before {
          content: "";
          position: absolute;
          inset: -20% -18%;
          background:
            linear-gradient(118deg, transparent 0 51%, rgba(255,255,255,0.045) 51.4% 65%, transparent 65.4%),
            radial-gradient(circle at 100% 0%, rgba(196, 163, 90, 0.18), transparent 32%);
          z-index: -1;
        }

        .reservation-hero__content {
          max-width: 420px;
          animation: reservationTextIn 0.68s ease 0.24s both;
        }

        .reservation-hero__brand {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: var(--brand-logo-size);
          height: var(--brand-logo-size);
          margin-bottom: clamp(24px, 4vh, 46px);
          border: 1px solid rgba(196, 163, 90, 0.48);
          border-radius: 14px;
          background: rgba(255, 250, 241, 0.055);
          box-shadow: 0 18px 32px rgba(0,0,0,0.22), inset 0 0 0 1px rgba(255, 250, 241, 0.035);
          cursor: pointer;
          transition: background 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
        }

        .reservation-hero__brand img {
          width: var(--brand-mark-size);
          height: var(--brand-mark-size);
          object-fit: contain;
          filter: drop-shadow(0 8px 16px rgba(0,0,0,0.24));
        }

        .reservation-hero__brand:hover,
        .reservation-hero__brand:focus-visible {
          background: rgba(196, 163, 90, 0.13);
          box-shadow: 0 22px 42px rgba(0,0,0,0.26), 0 0 0 1px rgba(196, 163, 90, 0.18);
          transform: translateY(-1px);
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
          font-size: clamp(44px, 3.75vw, 64px);
          line-height: 0.95;
          letter-spacing: -0.035em;
          font-weight: 540;
          color: #fffaf1;
        }

        .reservation-hero p {
          margin: clamp(18px, 2.4vh, 28px) 0 0;
          max-width: 360px;
          color: rgba(255, 248, 236, 0.84);
          font-size: clamp(13px, 0.82vw, 14px);
          line-height: 1.7;
        }

        .reservation-hero__manage {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-height: 38px;
          margin-top: clamp(18px, 2.4vh, 26px);
          border: 1px solid rgba(196, 163, 90, 0.42);
          border-radius: 10px;
          padding: 0 16px;
          background: rgba(255, 250, 241, 0.045);
          color: rgba(255, 250, 241, 0.88);
          font: inherit;
          font-size: 10px;
          font-weight: 760;
          letter-spacing: 0.13em;
          text-transform: uppercase;
          cursor: pointer;
          transition: background 0.22s ease, color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease;
        }

        .reservation-hero__manage:hover,
        .reservation-hero__manage:focus-visible {
          background: rgba(196, 163, 90, 0.16);
          color: #fffaf1;
          box-shadow: 0 12px 28px rgba(0,0,0,0.18);
          transform: translateY(-1px);
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
          font-weight: 560;
          color: #fffaf1;
        }

        .reservation-hero__footer span {
          max-width: 350px;
          color: rgba(255, 248, 236, 0.72);
          font-size: 12px;
          line-height: 1.65;
        }

        .reservation-directory {
          min-width: 0;
          min-height: 0;
          display: grid;
          grid-template-rows: auto minmax(0, 1fr);
          gap: clamp(24px, 2.6vh, 34px);
          padding: clamp(18px, 2vw, 28px);
          container-type: inline-size;
          border-radius: var(--radius-panel);
          background:
            linear-gradient(145deg, var(--paper-strong), var(--paper)),
            radial-gradient(circle at 20% 18%, rgba(196, 163, 90, 0.08), transparent 30%);
          box-shadow: 0 26px 80px rgba(42, 31, 18, 0.16);
          color: var(--ink);
          animation: reservationPanelIn 0.7s ease 0.24s both;
        }

        .reservation-launcher[data-theme="dark"] .reservation-directory {
          background:
            linear-gradient(145deg, rgba(22, 18, 13, 0.98), rgba(34, 27, 18, 0.95)),
            radial-gradient(circle at 20% 18%, rgba(196, 163, 90, 0.16), transparent 32%);
          color: var(--cream);
          box-shadow: 0 28px 90px rgba(8, 6, 4, 0.34);
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
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 10px;
        }

        .reservation-section__kicker {
          color: var(--muted);
          font-size: 8.5px;
          font-weight: 700;
          letter-spacing: 0.2em;
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
          font-family: "Inter", "Helvetica Neue", Arial, sans-serif;
          font-size: clamp(20px, 1.35vw, 27px);
          line-height: 1.05;
          font-weight: 760;
          letter-spacing: -0.035em;
          color: var(--ink);
        }

        .reservation-launcher[data-theme="dark"] .reservation-section__header h2 {
          color: var(--cream);
        }

        .reservation-grid {
          display: grid;
          gap: clamp(10px, 1vw, 16px);
        }

        .reservation-carousel {
          position: relative;
          min-width: 0;
          isolation: isolate;
        }

        .reservation-carousel__viewport {
          overflow: hidden;
          min-width: 0;
          margin: -22px -14px -18px;
          padding: 22px 14px 18px;
        }

        .reservation-carousel__track {
          position: relative;
          min-width: 0;
          contain: layout paint;
        }

        .reservation-carousel__slide {
          position: absolute;
          top: 0;
          left: 0;
          height: 100%;
          min-width: 0;
          --slide-x: 0px;
          --slide-nudge: 0px;
          opacity: 0.28;
          filter: saturate(0.78) brightness(0.66);
          transform: translate3d(calc(var(--slide-x) + var(--slide-nudge)), 0, 0) scale(0.82);
          transform-origin: center;
          transition:
            opacity 520ms cubic-bezier(0.22, 1, 0.36, 1),
            filter 520ms cubic-bezier(0.22, 1, 0.36, 1),
            transform 560ms cubic-bezier(0.22, 1, 0.36, 1);
          will-change: transform, opacity, filter;
          z-index: 1;
          pointer-events: none;
          backface-visibility: hidden;
          transform-style: preserve-3d;
        }

        .reservation-carousel__slide .reservation-card {
          height: 100%;
          transition: transform 0.32s ease, box-shadow 0.32s ease, filter 0.32s ease;
        }

        .reservation-carousel__slide.is-near {
          opacity: 0.66;
          filter: saturate(0.9) brightness(0.78);
          transform: translate3d(calc(var(--slide-x) + var(--slide-nudge)), 0, 0) scale(0.94);
          pointer-events: auto;
        }

        .reservation-carousel__slide.is-before {
          --slide-nudge: 12px;
        }

        .reservation-carousel__slide.is-after {
          --slide-nudge: -12px;
        }

        .reservation-carousel__slide.is-active {
          opacity: 1;
          filter: saturate(1.02) brightness(1);
          transform: translate3d(var(--slide-x), 0, 0) scale(1.02);
          z-index: 5;
          pointer-events: auto;
        }

        .reservation-carousel__slide.is-active .reservation-card {
          box-shadow: 0 32px 68px rgba(23, 19, 14, 0.36), 0 10px 28px rgba(164, 120, 33, 0.13), inset 0 0 0 1px rgba(196, 163, 90, 0.16);
        }

        .reservation-carousel__slide.is-near .reservation-card {
          box-shadow: 0 14px 30px rgba(23, 19, 14, 0.18), inset 0 0 0 1px rgba(255, 250, 241, 0.035);
        }

        .reservation-carousel__slide.is-active .reservation-card__shade {
          background:
            linear-gradient(180deg, rgba(0,0,0,0.01), rgba(0,0,0,0.56)),
            radial-gradient(circle at 24% 18%, rgba(255, 232, 182, 0.2), transparent 40%),
            linear-gradient(90deg, rgba(0,0,0,0.22), transparent 70%);
        }

        .reservation-carousel__slide.is-near .reservation-card__shade {
          background:
            linear-gradient(180deg, rgba(0,0,0,0.12), rgba(0,0,0,0.76)),
            radial-gradient(circle at 24% 18%, rgba(255, 232, 182, 0.08), transparent 34%),
            linear-gradient(90deg, rgba(0,0,0,0.38), transparent 64%);
        }

        .reservation-carousel__slide.is-dimmed .reservation-card__title,
        .reservation-carousel__slide.is-dimmed .reservation-card__logo {
          opacity: 0.62;
        }

        .reservation-carousel__control {
          position: absolute;
          top: 50%;
          z-index: 8;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 38px;
          height: 46px;
          border: 1px solid rgba(255, 250, 241, 0.18);
          border-radius: 11px;
          background: rgba(17, 13, 9, 0.58);
          color: #fffaf1;
          box-shadow: 0 18px 34px rgba(0, 0, 0, 0.22), inset 0 0 0 1px rgba(196, 163, 90, 0.12);
          backdrop-filter: blur(14px);
          cursor: pointer;
          transform: translateY(-50%);
          transition: background 0.22s ease, border-color 0.22s ease, box-shadow 0.22s ease, transform 0.22s ease, color 0.22s ease;
        }

        .reservation-carousel__control span {
          display: block;
          margin-top: -2px;
          font-size: 30px;
          line-height: 1;
          font-family: Georgia, serif;
        }

        .reservation-carousel__control--prev {
          left: 4px;
        }

        .reservation-carousel__control--next {
          right: 4px;
        }

        .reservation-carousel__control:hover,
        .reservation-carousel__control:focus-visible {
          background: rgba(164, 120, 33, 0.86);
          border-color: rgba(255, 250, 241, 0.34);
          box-shadow: 0 20px 42px rgba(0, 0, 0, 0.28), 0 0 0 1px rgba(196, 163, 90, 0.18);
          color: #fffaf1;
          outline: none;
          transform: translateY(-50%) scale(1.035);
        }

        .reservation-launcher[data-theme="light"] .reservation-carousel__control {
          border-color: rgba(164, 120, 33, 0.24);
          background: rgba(255, 252, 246, 0.72);
          color: #6d4d16;
          box-shadow: 0 16px 32px rgba(42, 31, 18, 0.15), inset 0 0 0 1px rgba(255, 255, 255, 0.52);
        }

        .reservation-launcher[data-theme="light"] .reservation-carousel__control:hover,
        .reservation-launcher[data-theme="light"] .reservation-carousel__control:focus-visible {
          background: rgba(164, 120, 33, 0.88);
          color: #fffaf1;
        }

        .reservation-grid--dining {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }

        .reservation-grid--events {
          grid-template-columns: repeat(3, minmax(0, 1fr));
          grid-auto-rows: minmax(0, 1fr);
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
          aspect-ratio: 16 / 9;
        }

        .reservation-card--event {
          min-height: 0;
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

        .reservation-card__logo {
          position: absolute;
          top: 14px;
          left: 14px;
          z-index: 3;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: var(--outlet-logo-size);
          height: var(--outlet-logo-size);
          padding: 0;
          border-radius: 10px;
          background: #ffffff;
          color: #7f5e20;
          box-shadow: 0 14px 28px rgba(0, 0, 0, 0.22);
          overflow: hidden;
          pointer-events: none;
        }

        .reservation-card__logo img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          filter: contrast(1.025) saturate(1.025);
          image-rendering: auto;
          transform: translateZ(0);
          backface-visibility: hidden;
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
          font-weight: 780;
          letter-spacing: -0.035em;
          text-shadow: 0 3px 18px rgba(0, 0, 0, 0.76);
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

        .reservation-card:hover,
        .reservation-card:focus-within {
          transform: translateY(-3px);
          box-shadow: 0 24px 50px rgba(23, 19, 14, 0.24), inset 0 0 0 1px rgba(196, 163, 90, 0.16);
          outline: none;
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
            --brand-logo-size: 50px;
            --brand-mark-size: 36px;
            --outlet-logo-size: clamp(48px, 4vw, 64px);
            grid-template-rows: 46px minmax(0, 1fr);
            gap: 10px;
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
            padding: 18px 22px;
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
            --outlet-logo-size: clamp(50px, 4.6vw, 68px);
          }

          .reservation-shell {
            grid-template-columns: minmax(clamp(260px, 32vw, 390px), 0.72fr) minmax(0, 1.28fr);
            gap: 18px;
          }

          .reservation-directory {
            padding: 18px;
          }
        }

        @media (max-width: 980px) {
          .reservation-launcher {
            --brand-logo-size: 54px;
            --brand-mark-size: 39px;
            --outlet-logo-size: clamp(50px, 8vw, 68px);
            height: auto;
            min-height: 100vh;
            min-height: 100svh;
            overflow: auto;
            grid-template-rows: auto auto;
            background: linear-gradient(160deg, #17130e 0%, #2a2118 30%, #f8f3e9 30.2%, #fbf7ef 100%);
          }

          .reservation-shell {
            grid-template-columns: 1fr;
          }

          .reservation-hero {
            min-height: 420px;
          }

          .reservation-grid--dining,
          .reservation-grid--events {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            height: auto;
          }

          .reservation-carousel__slide {
            transform: translate3d(calc(var(--slide-x) + var(--slide-nudge)), 0, 0) scale(0.78);
          }

          .reservation-carousel__slide.is-near {
            transform: translate3d(calc(var(--slide-x) + var(--slide-nudge)), 0, 0) scale(0.88);
          }

          .reservation-carousel__slide.is-before {
            --slide-nudge: 10px;
          }

          .reservation-carousel__slide.is-after {
            --slide-nudge: -10px;
          }

          .reservation-carousel__slide.is-active {
            transform: translate3d(var(--slide-x), 0, 0) scale(1.03);
          }

          .reservation-card--event {
            aspect-ratio: 1.7 / 1;
          }
        }

        @media (max-width: 720px) {
          .reservation-launcher {
            --radius-panel: 18px;
            --radius-card: 12px;
            --brand-logo-size: 48px;
            --brand-mark-size: 34px;
            --outlet-logo-size: clamp(46px, 16vw, 58px);
            padding: 12px;
            gap: 12px;
          }

          .reservation-topbar {
            align-items: flex-start;
            border-radius: 16px;
            flex-direction: column;
            padding: 12px;
          }

          .reservation-topbar__nav {
            width: 100%;
            flex-wrap: wrap;
          }

          .reservation-topbar__nav button {
            flex: 1;
            min-width: 132px;
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

          .reservation-carousel__viewport {
            margin: -22px -6px -22px;
            padding: 22px 6px;
          }

          .reservation-carousel__control {
            width: 31px;
            height: 38px;
          }

          .reservation-carousel__control--prev {
            left: 3px;
          }

          .reservation-carousel__control--next {
            right: 3px;
          }

          .reservation-carousel__slide {
            opacity: 0.34;
            transform: translate3d(calc(var(--slide-x) + var(--slide-nudge)), 0, 0) scale(0.8);
          }

          .reservation-carousel__slide.is-near {
            opacity: 0.6;
            transform: translate3d(calc(var(--slide-x) + var(--slide-nudge)), 0, 0) scale(0.84);
          }

          .reservation-carousel__slide.is-before {
            --slide-nudge: 8px;
          }

          .reservation-carousel__slide.is-after {
            --slide-nudge: -8px;
          }

          .reservation-carousel__slide.is-active {
            transform: translate3d(var(--slide-x), 0, 0) scale(1.01);
          }

          .reservation-card--dining,
          .reservation-card--event {
            aspect-ratio: 1.62 / 1;
          }
        }

        @media (max-width: 460px) {
          .reservation-launcher {
            --outlet-logo-size: clamp(42px, 14vw, 52px);
            padding: 10px;
          }

          .reservation-directory {
            padding: 14px;
          }

          .reservation-card__logo {
            top: 10px;
            left: 10px;
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

