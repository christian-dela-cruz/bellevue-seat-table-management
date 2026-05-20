import { useState } from "react";
import { useNavigate } from "react-router-dom";
import bellevueLogo from "../../../assets/bellevue-logo.png";
import hanakazuImg from "../../../assets/hanakazu.jpeg";
import qsinaImg from "../../../assets/qsina.jpeg";
import phoenixCourtImg from "../../../assets/phoenix-court.jpeg";
import hanakazuLogo from "../../../assets/hanakazu-logo-enhanced.png";
import qsinaLogo from "../../../assets/qsina-logo-enhanced.png";
import phoenixCourtLogo from "../../../assets/phoenix-court-logo.webp";
import alabangImg from "../../../assets/afc.jpeg";
import lagunaImg from "../../../assets/laguna.jpeg";
import twentyTwentyImg from "../../../assets/20-20.jpeg";
import grandBallroomImg from "../../../assets/grand-ballroom-photo.jpg";
import towerBallroomImg from "../../../assets/towerb.jpeg";
import businessCenterImg from "../../../assets/bc.jpeg";

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

const eventVenues = [
  {
    title: "Alabang Function Room",
    image: alabangImg,
    route: "/alabang-reserve",
  },
  {
    title: "Laguna Ballroom",
    image: lagunaImg,
    route: "/laguna-reserv1e",
    rooms: [
      { label: "1", route: "/laguna-reserv1e" },
      { label: "2", route: "/laguna-reserv2e" },
    ],
  },
  {
    title: "20/20 Function Room",
    image: twentyTwentyImg,
    route: "/twenty-twenty-a",
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
  },
];

function VenueCard({ item, variant = "event" }) {
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
        draggable="false"
      />
      <span className="reservation-card__shade" />
      <button
        type="button"
        className="reservation-card__hitarea"
        onClick={() => navigate(item.route)}
        aria-label={`Reserve ${item.title}`}
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
            >
              {room.label}
            </button>
          ))}
        </span>
      )}
    </article>
  );
}

export default function ReservationLanding() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState("dark");
  const isLight = theme === "light";

  return (
    <main className="reservation-launcher" data-theme={theme}>
      <header className="reservation-topbar">
        <button
          type="button"
          className="reservation-topbar__brand"
          onClick={() => navigate("/")}
          aria-label="The Bellevue Manila reservation home"
        >
          <img src={bellevueLogo} alt="" />
        </button>

        <nav className="reservation-topbar__nav" aria-label="Reservation quick navigation">
          <button type="button" onClick={() => navigate("/manage-booking")}>
            Manage Booking
          </button>
          <button
            type="button"
            className="reservation-theme-toggle"
            onClick={() => setTheme(isLight ? "dark" : "light")}
            aria-pressed={isLight}
            aria-label={`Switch to ${isLight ? "dark" : "light"} mode`}
          >
            <span>{isLight ? "Light" : "Dark"}</span>
            <i aria-hidden="true" />
          </button>
        </nav>
      </header>

      <div className="reservation-shell">
        <section className="reservation-hero" aria-label="Bellevue reservation introduction">
          <div className="reservation-hero__content">
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
              <span>Click a card to reserve</span>
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
              <span>Rooms remain inside the card</span>
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
          min-height: 100vh;
          height: 100vh;
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
          justify-content: space-between;
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

        .reservation-topbar__brand,
        .reservation-topbar__nav button {
          font: inherit;
          border: 0;
          background: transparent;
          color: inherit;
        }

        .reservation-topbar__brand {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 0;
          cursor: pointer;
        }

        .reservation-topbar__brand img {
          width: 34px;
          height: 34px;
          object-fit: contain;
          padding: 6px;
          border: 1px solid rgba(196, 163, 90, 0.48);
          border-radius: 12px;
          background: rgba(16, 12, 8, 0.28);
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
          gap: 9px;
          min-width: 86px;
          padding-right: 8px !important;
        }

        .reservation-theme-toggle i {
          position: relative;
          width: 34px;
          height: 20px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(255, 250, 241, 0.22), rgba(196, 163, 90, 0.18));
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.13), 0 7px 16px rgba(0,0,0,0.12);
        }

        .reservation-theme-toggle i::after {
          content: "";
          position: absolute;
          top: 3px;
          left: 3px;
          width: 14px;
          height: 14px;
          border-radius: 7px;
          background: linear-gradient(135deg, #d8bd78, var(--gold));
          transition: transform 0.28s ease, background 0.28s ease, box-shadow 0.28s ease;
          box-shadow: 0 3px 8px rgba(0,0,0,0.22);
        }

        .reservation-theme-toggle[aria-pressed="true"] i::after {
          transform: translateX(14px);
          background: linear-gradient(135deg, #6b5735, #2a2117);
        }

        .reservation-shell {
          min-height: 0;
          display: grid;
          grid-template-columns: minmax(300px, 0.68fr) minmax(720px, 1.42fr);
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

        .reservation-eyebrow {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: clamp(16px, 2vh, 26px);
          color: var(--gold-soft);
          font-size: 10px;
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
          font-size: clamp(48px, 4.1vw, 72px);
          line-height: 0.95;
          letter-spacing: -0.035em;
          font-weight: 540;
          color: #fffaf1;
        }

        .reservation-hero p {
          margin: clamp(18px, 2.4vh, 28px) 0 0;
          max-width: 360px;
          color: rgba(255, 248, 236, 0.84);
          font-size: clamp(13px, 0.95vw, 16px);
          line-height: 1.7;
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
          gap: clamp(12px, 1.5vh, 18px);
          padding: clamp(18px, 2vw, 28px);
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

        .reservation-section__header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 10px;
        }

        .reservation-section__kicker,
        .reservation-section__header > span {
          color: var(--muted);
          font-size: 9px;
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
          font-family: "Playfair Display", Georgia, serif;
          font-size: clamp(24px, 1.8vw, 34px);
          line-height: 1;
          font-weight: 540;
          color: var(--ink);
        }

        .reservation-launcher[data-theme="dark"] .reservation-section__header h2 {
          color: var(--cream);
        }

        .reservation-launcher[data-theme="dark"] .reservation-section__header > span {
          color: rgba(255, 248, 236, 0.62);
        }

        .reservation-grid {
          display: grid;
          gap: clamp(10px, 1vw, 16px);
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
          aspect-ratio: 1.9 / 1;
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
          filter: saturate(1.08) contrast(1.08) brightness(0.96);
          transform: scale(1.01);
          transition: transform 0.48s ease, filter 0.48s ease;
          will-change: transform;
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
          width: clamp(70px, 5.5vw, 92px);
          height: clamp(70px, 5.5vw, 92px);
          padding: 0;
          border-radius: 10px;
          background: linear-gradient(145deg, rgba(255, 250, 241, 0.94), rgba(238, 228, 208, 0.82));
          color: #7f5e20;
          box-shadow: 0 14px 28px rgba(0, 0, 0, 0.18), inset 0 0 0 1px rgba(255, 255, 255, 0.44);
          backdrop-filter: blur(10px);
          overflow: hidden;
          pointer-events: none;
        }

        .reservation-card__logo img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          filter: contrast(1.04) saturate(1.04);
        }

        .reservation-card__logo span {
          font-family: "Playfair Display", Georgia, serif;
          font-size: clamp(13px, 0.95vw, 17px);
          font-weight: 620;
          line-height: 1.02;
          text-align: center;
        }

        .reservation-card__title {
          position: absolute;
          left: clamp(14px, 1.1vw, 20px);
          right: clamp(14px, 1.1vw, 20px);
          bottom: clamp(13px, 1vw, 18px);
          z-index: 3;
          font-family: "Playfair Display", Georgia, serif;
          font-size: clamp(19px, 1.45vw, 28px);
          line-height: 0.98;
          color: #fffaf1;
          font-weight: 620;
          text-shadow: 0 3px 18px rgba(0, 0, 0, 0.76);
          pointer-events: none;
        }

        .reservation-card--event .reservation-card__title {
          font-size: clamp(17px, 1.15vw, 23px);
          max-width: calc(100% - 28px);
        }

        .reservation-card__rooms {
          position: absolute;
          right: clamp(10px, 0.9vw, 15px);
          top: 50%;
          z-index: 4;
          display: inline-flex;
          flex-direction: column;
          gap: 7px;
          transform: translateY(-50%);
        }

        .reservation-card--has-rooms .reservation-card__title {
          right: clamp(50px, 3.6vw, 62px);
        }

        .reservation-card__room {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 25px;
          height: 25px;
          border: 1px solid rgba(255, 250, 241, 0.62);
          border-radius: 8px;
          background: rgba(14, 11, 8, 0.58);
          color: #fffaf1;
          font-size: 10px;
          font-weight: 760;
          line-height: 1;
          box-shadow: 0 7px 16px rgba(0,0,0,0.28);
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
          transform: scale(1.055);
          filter: saturate(1.14) contrast(1.12) brightness(1);
        }

        .reservation-card:hover .reservation-card__shade,
        .reservation-card:focus-within .reservation-card__shade {
          opacity: 0.9;
          background:
            linear-gradient(180deg, rgba(0,0,0,0.03), rgba(0,0,0,0.78)),
            radial-gradient(circle at 22% 18%, rgba(255, 232, 182, 0.18), transparent 38%),
            linear-gradient(90deg, rgba(0,0,0,0.4), transparent 68%);
        }

        .reservation-card__hitarea:focus-visible {
          outline: 2px solid rgba(196, 163, 90, 0.82);
          outline-offset: -6px;
          border-radius: var(--radius-card);
        }

        .reservation-card__room:hover,
        .reservation-card__room:focus-visible {
          background: #c4a35a;
          border-color: #c4a35a;
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
            font-size: clamp(44px, 3.8vw, 62px);
          }

          .reservation-hero p {
            margin-top: 16px;
            line-height: 1.6;
          }

          .reservation-directory {
            padding: 18px 22px;
            gap: 10px;
          }

          .reservation-section__header h2 {
            font-size: clamp(22px, 1.65vw, 30px);
          }

          .reservation-grid {
            gap: 10px;
          }
        }

        @media (max-width: 1280px) {
          .reservation-shell {
            grid-template-columns: minmax(280px, 0.72fr) minmax(660px, 1.28fr);
            gap: 18px;
          }

          .reservation-directory {
            padding: 18px;
          }
        }

        @media (max-width: 980px) {
          .reservation-launcher {
            height: auto;
            min-height: 100vh;
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

          .reservation-card--event {
            aspect-ratio: 1.7 / 1;
          }
        }

        @media (max-width: 720px) {
          .reservation-launcher {
            --radius-panel: 18px;
            --radius-card: 12px;
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
            font-size: 46px;
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

          .reservation-card--dining,
          .reservation-card--event {
            aspect-ratio: 1.62 / 1;
          }
        }
      `}</style>
    </main>
  );
}
